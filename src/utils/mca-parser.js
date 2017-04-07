import minecraftRegion from 'minecraft-region';
import blockInfos from '../constants/blocks';
import biomeInfos from '../constants/biomes';

/*
 * Level format reference:
 * http://minecraft.gamepedia.com/Level_format
 * Chunk format reference:
 * http://minecraft.gamepedia.com/Chunk_format
 */
const SECTION_SIZE = 16 * 16 * 16;

let region;
let selection;
let yBuffer;
let occupancy;

export const REGION_FILE_PATTERN = /\.mca$/;

/*
 * load a Minecraft region file
 * @param {string} filename - name of the .mca
 * @param {ArrayBuffer} data
 */
export function loadMCA(filename, data) {
  try {
    region = minecraftRegion(data);
  } catch (error) {
    region = null;
    selection = null;
    return {error}
  }

  const availableChunks = [];
  const heightMap = new Uint8ClampedArray(512 * 512);

  for (let chunkX = 0; chunkX < 32; chunkX++) {
    for (let chunkZ = 0; chunkZ < 32; chunkZ++) {
      const chunk = region.getChunk(chunkX, chunkZ);
      if (chunk) {
        availableChunks.push([chunkX, chunkZ]);

        const offsetX = chunkX << 4;
        const offsetZ = chunkZ << 4;

        chunk.root.Level.HeightMap.forEach((h, i) => {
          const x = (i % 16) + offsetX;
          const z = (i >> 4) + offsetZ;

          heightMap[(z << 9) + x] = h;
        });
      }
    }
  }

  // reset states
  resetBuffers();

  return {
    availableChunks,
    heightMap
  };
}

function resetBuffers() {
  selection = {
    chunks: [],
    data: [],
    blockCount: 0
  };
  // sort by accending Y
  yBuffer = (new Array(256).fill(0)).map(d => []);
  occupancy = {};
}

/*
 * @param {array} chunks - array of [chunkX, chunkZ]
 */
export function readChunks(chunks) {
  if (!region) {
    return selection;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let needsUpdate = false;
  let counter = 0;

  const shouldCleanHouse = selection.chunks.length && 
    selection.chunks.every(([chunkX, chunkZ]) => findChunkIndex(chunks, chunkX, chunkZ) < 0);

  if (shouldCleanHouse) {
    resetBuffers();
    needsUpdate = true;
  } else {
    // incremental
    selection.chunks.forEach(([chunkX, chunkZ]) => {
      const i = findChunkIndex(chunks, chunkX, chunkZ);
      if (i < 0) {
        removeChunk(chunkX, chunkZ);
        needsUpdate = true;
      }
    });
  }

  // add new chunks
  chunks.forEach(([chunkX, chunkZ]) => {
    const i = findChunkIndex(selection.chunks, chunkX, chunkZ);
    if (i < 0) {
      addChunk(chunkX, chunkZ);
      needsUpdate = true;
    }
  });

  if (!needsUpdate) {
    return selection;
  }

  const data = yBuffer.reduce((acc, arr) => acc.concat(arr), []);
  data.forEach((d, i) => {
    if (d.parent) {
      d.index = d.parent.index;
    } else {
      d.index = i;
      counter++;

      const [x, y, z] = d.position;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  });

  selection = {
    chunks,
    data,
    blockCount: counter,
    bounds: counter ? {minX, minY, minZ, maxX, maxY, maxZ} : null
  };

  return selection;
}

/*
 * drops loaded chunk from cache
 */
function removeChunk(chunkX, chunkZ) {
  const chunk = region.getChunk(chunkX, chunkZ);

  if (!chunk) {
    return;
  }

  const {xPos, zPos} = chunk.root.Level;
  const xOffset = xPos * 16;
  const zOffset = zPos * 16;

  for (let y = 0; y < yBuffer.length; y++) {
    yBuffer[y] = yBuffer[y].filter(b => {
      const x = b.position[0];
      const z = b.position[2];
      return x < xOffset || x >= xOffset + 16 || z < zOffset || z >= zOffset + 16;
    });
  }

  occupancy[xPos][zPos] = null;
}

/*
 * loads chunk data into cache
 */
function addChunk(chunkX, chunkZ) {
  const chunk = region.getChunk(chunkX, chunkZ);

  if (!chunk) {
    return;
  }

  const {xPos, zPos, Sections, Biomes} = chunk.root.Level;
  const biomes = Biomes || (new Uint8Array(256)).fill(4);
  const xOffset = xPos * 16;
  const zOffset = zPos * 16;

  const chunkOccupancy = new Uint16Array(4096);
  if (!occupancy[xPos]) {
    occupancy[xPos] = {};
  }
  occupancy[xPos][zPos] = chunkOccupancy;

  for (const section of Sections) {
    const yOffset = section.Y * 16;

    for (let i = 0; i < SECTION_SIZE; i++) {
      let blockId = section.Blocks[i];
      if (section.Add) {
        blockId += (get4BitData(section.Add, i) << 8);
      }
      const blockData = get4BitData(section.Data, i);
      const lighting = Math.min(
        get4BitData(section.BlockLight, i) + get4BitData(section.SkyLight, i),
        0xf
      );

      if (blockId === 0) {
        // air
        continue;
      }
      const meta = getBlockMetadata(blockId, blockData);
      if (!meta) {
        // unknown block
        continue;
      }

      const x = i & 0xf;
      const y = (i >> 8) + yOffset;
      const z = (i >> 4) & 0xf;
      const biome = biomeInfos[biomes[i % 256]] || biomeInfos.default;
      chunkOccupancy[(y << 4) + z] |= (meta.opaque << x);

      const b = {
        position: [x + xOffset, y, z + zOffset],
        block: meta,
        biome,
        blockId,
        blockData,
        lighting
      };

      yBuffer[y].push(b);

      if (meta.model === 'stairs') {
        // hack for stairs model
        yBuffer[y].push({
          ...b,
          parent: b,
          blockData: blockData + 8
        });
      }
    }
  }
}

function get4BitData(uint8Arr, index) {
  if (!(index % 2)) {
    // lower 4 bits
    return uint8Arr[index >> 1] & 0xf;
  }
  // upper 4 bits
  return uint8Arr[index >> 1] >> 4;
}

export function isBlockOpaque(x, y, z) {
  const posX = x >> 4;
  const posZ = z >> 4;
  
  const chunkOccupancy = occupancy[posX] && occupancy[posX][posZ];
  if (chunkOccupancy) {

    return chunkOccupancy[y * 16 + (z - (posZ << 4))] & (1 << (x - (posX << 4)));
  }
  return 0;
}

export function getBlockMetadata(id, data) {
  return blockInfos[`${id}:${data}`] ||
    blockInfos[`${id}:${0}`];
}

export function findChunkIndex(arr, x, z) {
  return arr.findIndex(c => c[0] === x && c[1] === z);
}

export function getBlockTemperature(block) {
  return block.biome.temp - Math.max(0, 0.00166667 * (block.position.y - 64));
}

export function getBlockHumidity(block) {
  return block.biome.humidity;
}
