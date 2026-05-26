export type SisaketVisualBookmark = {
  id: string;
  label: string;
  description: string;
  target: "province" | "district";
  districtCode?: string;
};

export type SisaketFutureDetailHook = {
  id: string;
  label: string;
  districtCode: string;
  assetType: "3d-tiles" | "gltf" | "photogrammetry";
  summary: string;
};

export type SisaketLandmarkPlaceholder = {
  id: string;
  label: string;
  districtCode: string;
  latitude: number;
  longitude: number;
  height: number;
  assetType: "3d-tiles" | "gltf";
  summary: string;
};

export type SisaketTourStep = {
  id: string;
  target: "bookmark" | "landmark";
};

export const sisaketVisualBookmarks: SisaketVisualBookmark[] = [
  {
    id: "province-overview",
    label: "ภาพรวมจังหวัด",
    description: "มุมกล้องกว้างสำหรับดูภูมิประเทศและขอบเขตทั้งจังหวัด",
    target: "province",
  },
  {
    id: "mueang-sisaket",
    label: "ตัวเมือง",
    description: "โฟกัสอำเภอเมืองศรีสะเกษสำหรับมุมมองเขตเมือง",
    target: "district",
    districtCode: "3301",
  },
  {
    id: "kantharalak",
    label: "กันทรลักษ์",
    description: "มุมมองฝั่งตะวันออกของจังหวัดใกล้แนวเทือกเขา",
    target: "district",
    districtCode: "3304",
  },
  {
    id: "phu-sing",
    label: "ภูสิงห์",
    description: "มุมมองพื้นที่ชายแดนใต้ของจังหวัดสำหรับต่อยอด landmark detail",
    target: "district",
    districtCode: "3317",
  },
];

export const sisaketFutureDetailHooks: SisaketFutureDetailHook[] = [
  {
    id: "mueang-core",
    label: "แกนตัวเมืองศรีสะเกษ",
    districtCode: "3301",
    assetType: "3d-tiles",
    summary: "เหมาะกับการเพิ่มอาคารเมือง, จุดราชการ, และ city-scale detail ในอนาคต",
  },
  {
    id: "southern-border",
    label: "โซนภูสิงห์",
    districtCode: "3317",
    assetType: "photogrammetry",
    summary: "เหมาะกับงาน terrain และ visual landmark เฉพาะพื้นที่ฝั่งชายแดน",
  },
  {
    id: "eastern-corridor",
    label: "โซนกันทรลักษ์",
    districtCode: "3304",
    assetType: "gltf",
    summary: "เหมาะกับการวาง model สถานที่สำคัญหรือแลนด์มาร์กเฉพาะจุด",
  },
];

export const sisaketLandmarkPlaceholders: SisaketLandmarkPlaceholder[] = [
  {
    id: "sisaket-city-core",
    label: "ศูนย์กลางเมืองศรีสะเกษ",
    districtCode: "3301",
    latitude: 15.10694,
    longitude: 104.32944,
    height: 140,
    assetType: "3d-tiles",
    summary: "placeholder สำหรับ city-scale tileset ในเขตเทศบาลและแกนเมือง",
  },
  {
    id: "sisaket-railway-station",
    label: "สถานีรถไฟศรีสะเกษ",
    districtCode: "3301",
    latitude: 15.1164,
    longitude: 104.327,
    height: 120,
    assetType: "gltf",
    summary: "placeholder สำหรับ landmark แบบ glTF ของสถานีและสภาพแวดล้อมใกล้เคียง",
  },
  {
    id: "pha-mo-i-daeng",
    label: "ผามออีแดง",
    districtCode: "3304",
    latitude: 14.4450694,
    longitude: 104.7329222,
    height: 320,
    assetType: "gltf",
    summary: "placeholder สำหรับจุดชมวิวและ asset เชิงท่องเที่ยวฝั่งตะวันออกของจังหวัด",
  },
];

export const sisaketTourSequence: SisaketTourStep[] = [
  {
    id: "province-overview",
    target: "bookmark",
  },
  {
    id: "sisaket-city-core",
    target: "landmark",
  },
  {
    id: "sisaket-railway-station",
    target: "landmark",
  },
  {
    id: "kantharalak",
    target: "bookmark",
  },
  {
    id: "pha-mo-i-daeng",
    target: "landmark",
  },
  {
    id: "phu-sing",
    target: "bookmark",
  },
];
