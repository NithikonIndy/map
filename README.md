# Cesium + Nuxt (Bangkok Demo)

โปรเจกต์นี้เป็นเดโมแผนที่ 3D ด้วย `Nuxt 4 + Cesium` สำหรับทดลอง:
- โหมดเมืองกรุงเทพ (OSM Buildings + Bangkok Custom 3D)
- จำลองระดับน้ำและแผ่นน้ำท่วมตามเวลา
- ฝนจำลอง (particle) และฝนจริงแบบ Heatmap จาก Open-Meteo
- โหมด time-lapse เพื่อดูการเปลี่ยนแปลงตามเวลา

---

## 1) เทคโนโลยีหลัก

- `nuxt` 4
- `vue` 3
- `cesium` 1.x
- `@nuxt/ui` 4 + `tailwindcss` 4 (สำหรับ UI controls)

การตั้งค่า Nuxt สำคัญอยู่ที่ `nuxt.config.ts`:
- เปิด module `@nuxt/ui`
- โหลด CSS:
  - `~/assets/css/main.css`
  - `cesium/Build/Cesium/Widgets/widgets.css`
- copy Cesium static assets ไปที่ `/cesium` ด้วย `vite-plugin-static-copy`

---

## 2) ติดตั้งและรัน

### ติดตั้ง dependencies

```bash
bun install
```

### รัน dev server

```bash
bun run dev
```

เปิดที่ `http://localhost:3000`

### build / preview

```bash
bun run build
bun run preview
```

---

## 3) Environment Variables

สร้างไฟล์ `.env` (ถ้ายังไม่มี) แล้วใส่ค่าตามต้องการ:

```bash
NUXT_PUBLIC_CESIUM_ION_TOKEN=
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL=
```

คำอธิบาย:
- `NUXT_PUBLIC_CESIUM_ION_TOKEN`
  - ใช้เปิด Cesium World Terrain และ OSM Buildings
- `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - สำรองสำหรับโหมด/การใช้งานที่ต้องใช้ Google API
- `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL`
  - URL ของ Bangkok Custom 3D Tileset (extruded buildings)

---

## 4) โหมดหลักในแอป

ในหน้า `app/app.vue` มีตัวเลือกโหมด viewer หลัก:
- `sisaket`
- `photorealistic`
- `bangkok-osm`

โหมดที่พัฒนาเชิงฟีเจอร์มากที่สุดคือ `BangkokOsmBuildingsViewer.vue` ซึ่งมี:
- Layer toggles
- Camera spots
- Time simulation controls
- Water summary + water stations
- Rain heatmap controls (Open-Meteo)

---

## 5) ระบบเวลาและข้อมูลน้ำ

แกนเวลาหลักอยู่ที่ `app/components/visual-map/bangkokWaterTimeSeries.ts`

ค่าหลัก:
- วันที่จำลอง: `WATER_SIMULATION_DATE`
- เวลาเริ่ม/จบ clock: `00:00` ถึง `24:00`
- ช่วงฝน: `12:00–16:00`

ระบบนี้สร้าง:
- station level properties
- flood level property
- helper แปลงเวลา/คำนวณ progress

### พฤติกรรมปัจจุบัน (สำคัญ)
- ระดับน้ำทุกจุดเริ่มจาก `0`
- flood surface เริ่มจาก `0`
- ระดับและสถานะ marker เปลี่ยนตาม simulation
- flood visual ถูกทำให้:
  - จาง/เข้มตาม depth
  - ซ่อนอัตโนมัติเมื่อ depth ต่ำกว่า threshold

---

## 6) ระบบฝน

### 6.1 ฝนจำลอง (Particle)
- ใช้ `bangkokRainLayer.ts`
- เปิด/ปิดผ่าน layer `ฝนตก (จำลอง)`

### 6.2 ฝนจริง (Heatmap)
- ใช้ `bangkokRainHeatmapLayer.ts` + `openMeteoRainClient.ts`
- ปัจจุบัน UI เป็นแบบ “เลือกวัน + เลือกชั่วโมง” (รายชั่วโมง)
- โหลดข้อมูลวันเดียวจาก Open-Meteo แล้ว map เป็น heatmap overlay

หมายเหตุ:
- โค้ด optimize เพื่อลดค้างระหว่าง time-lapse แล้ว (fast/slow path, throttle งานหนัก)

---

## 7) Time-lapse และ Performance

### โหมด Lite timelapse (แนะนำ)
ในแผง “จำลองระดับน้ำตามเวลา” มีสวิตช์ **Lite timelapse** (เปิดเป็นค่าเริ่มต้น) ซึ่งทำงานอัตโนมัติเมื่อกดเล่นและความเร็ว ≥ 50×:
- ปิดฝน particle ชั่วคราว
- ไม่อัปเดต label บน marker ทุกรอบ (ลดงาน Cesium)
- ลดคุณภาพ tileset (เพิ่ม `maximumScreenSpaceError`)
- อัปเดตแสงกลางวัน/กลางคืนเฉพาะเมื่อ phase เปลี่ยน
- ใช้ `requestRenderMode` และจำกัดเฟรมตอนเล่น (~30 fps)

### แนวทางใช้งาน
| สถานการณ์ | แนะนำ |
|-----------|--------|
| เล่น timeline เร็ว | เปิด Lite, เริ่มที่ 50× ก่อน |
| RAM < 16 GB | อย่าเปิด OSM Buildings + Bangkok Custom 3D พร้อมกัน |
| ดูฝน Open-Meteo | เลือกวัน/ชม. แล้วดูนิ่ง ๆ — ปิด heatmap ตอนเล่น timelapse |
| หลังเล่นยาว ๆ tab > 3 GB | รีเฟรชหน้าเพื่อคืน memory |

### สิ่งที่ optimize แล้วในโค้ด
- แยก clock ของ Cesium กับ Vue UI (ไม่อัปเดต reactive ทุก tick)
- Heatmap ใช้ canvas + entity เดียว (ไม่สร้าง imagery layer ใหม่ทุกเฟรม)
- โหลด heatmap เมื่อเปิด layer เท่านั้น (ไม่ fetch ตอน mount)
- reuse `ConstantProperty` สำหรับ marker/flood แทนการสร้างใหม่ซ้ำ
- flood surface ไม่ใช้ `CallbackProperty` แล้ว

ถ้ายังหน่วง:
1. ลดความเร็ว multiplier
2. ปิดบาง layer ที่หนัก (flood, heatmap, clouds, Custom 3D)
3. เปิด hardware acceleration ใน browser

---

## 8) Bangkok Custom 3D Tiles Workflow

โปรเจกต์มีสคริปต์สำหรับสร้าง/เสิร์ฟ Bangkok tiles:

```bash
bun run bangkok:tiles:manifest
bun run bangkok:tiles:fetch-buildings
bun run bangkok:tiles:prepare
bun run bangkok:tiles:generate
bun run bangkok:tiles:serve
bun run bangkok:tiles:verify-http
bun run bangkok:tiles:all
```

ตัวอย่าง local flow:
1. สร้าง tiles:
   - `bun run bangkok:tiles:all`
2. เสิร์ฟ tiles:
   - `BANGKOK_TILES_PORT=8006 bun run bangkok:tiles:serve`
3. ตั้งค่า `.env`:
   - `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL=http://localhost:8006/tilesets/bangkok/tileset.json`
4. รีสตาร์ต `bun run dev`

ดูรายละเอียดเพิ่มใน `docs/bangkok-custom-tiles.md`

---

## 9) โครงสร้างไฟล์ที่ควรรู้

- `app/components/BangkokOsmBuildingsViewer.vue`
  - orchestration หลักของ scene, layer, time, interaction
- `app/components/visual-map/bangkokWaterTimeSeries.ts`
  - logic simulation น้ำ/น้ำท่วม
- `app/components/visual-map/bangkokFloodWaterSurface.ts`
  - flood rectangle surface + sync visibility
- `app/components/visual-map/openMeteoRainClient.ts`
  - ดึงและจัดข้อมูลฝนจาก Open-Meteo
- `app/composable/bangkokRainHeatmapLayer.ts`
  - render heatmap บน canvas แล้ว overlay เป็น entity (ไม่สร้าง imagery layer ซ้ำ)

---

## 10) ปัญหาที่เจอบ่อย

### หา CSS ไม่เจอ (`~/assets/css/main.css`)
- โปรเจกต์ใช้โครง `app/`
- ต้องวางไฟล์ไว้ที่ `app/assets/css/main.css` (ไม่ใช่ root `assets/`)

### เปิด OSM Buildings / Terrain ไม่ได้
- ตรวจ `NUXT_PUBLIC_CESIUM_ION_TOKEN`

### Bangkok Custom 3D ไม่ขึ้น
- ตรวจ URL ใน `NUXT_PUBLIC_BANGKOK_PHOTOREALISTIC_TILESET_URL`
- ตรวจว่า tile server ตอบไฟล์ `tileset.json` ได้จริง

---

## 11) ข้อเสนอการพัฒนาต่อ

- เพิ่ม preset performance (`quality / balanced / performance`)
- เพิ่ม profiling panel (frame time, update cost)
- แยก worker สำหรับคำนวณ heatmap ภายนอก main thread
- เพิ่ม test snapshot สำหรับ timeline keyframes สำคัญ
