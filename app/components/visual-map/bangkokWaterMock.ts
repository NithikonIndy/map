export type WaterLevelStatus = "normal" | "watch" | "warning" | "critical";

export type BangkokWaterStation = {
  id: string;
  label: string;
  districtCode: string;
  latitude: number;
  longitude: number;
  levelMeters: number;
  status: WaterLevelStatus;
  updatedAt: string;
  summary: string;
};

export const bangkokWaterStations: BangkokWaterStation[] = [
  {
    id: "chao-phraya-phra-nakhon",
    label: "เจ้าพระยา - พระนคร",
    districtCode: "1001",
    latitude: 13.7563,
    longitude: 100.4931,
    levelMeters: 1.82,
    status: "watch",
    updatedAt: "2026-05-26 10:10",
    summary: "ระดับน้ำสูงกว่าค่าเฉลี่ยช่วงเช้า ควรเฝ้าระวังพื้นที่ริมน้ำและท่าเรือ",
  },
  {
    id: "rattanakosin-canal",
    label: "คลองรอบกรุง",
    districtCode: "1001",
    latitude: 13.7504,
    longitude: 100.5014,
    levelMeters: 1.41,
    status: "normal",
    updatedAt: "2026-05-26 10:12",
    summary: "ระดับน้ำอยู่ในช่วงปกติ การระบายน้ำยังทำได้ตามปกติ",
  },
  {
    id: "yan-nawa-riverside",
    label: "ริมน้ำยานนาวา",
    districtCode: "1012",
    latitude: 13.7058,
    longitude: 100.5157,
    levelMeters: 2.36,
    status: "warning",
    updatedAt: "2026-05-26 10:09",
    summary: "ระดับน้ำแตะเกณฑ์เตือน พื้นที่แนวริมน้ำควรติดตามอย่างใกล้ชิด",
  },
  {
    id: "khlong-toei-port",
    label: "ท่าเรือคลองเตย",
    districtCode: "1033",
    latitude: 13.7021,
    longitude: 100.5601,
    levelMeters: 1.97,
    status: "watch",
    updatedAt: "2026-05-26 10:08",
    summary: "ระดับน้ำสูงขึ้นต่อเนื่อง เหมาะกับการใช้เป็นจุดเฝ้าระวังเชิงลอจิสติกส์",
  },
  {
    id: "lat-phrao-canal",
    label: "คลองลาดพร้าว",
    districtCode: "1005",
    latitude: 13.8117,
    longitude: 100.6085,
    levelMeters: 2.74,
    status: "critical",
    updatedAt: "2026-05-26 10:05",
    summary: "ระดับน้ำอยู่ในโซนวิกฤต จำลองเคสที่ต้องเตรียมปิดจุดเสี่ยงและแจ้งเตือนทันที",
  },
  {
    id: "bang-khen-channel",
    label: "คลองบางเขน",
    districtCode: "1005",
    latitude: 13.8613,
    longitude: 100.6047,
    levelMeters: 1.66,
    status: "normal",
    updatedAt: "2026-05-26 10:11",
    summary: "ระดับน้ำทรงตัวและยังต่ำกว่าเกณฑ์เฝ้าระวัง",
  },
  {
    id: "thon-buri-riverside",
    label: "ริมเจ้าพระยาฝั่งธนบุรี",
    districtCode: "1020",
    latitude: 13.7314,
    longitude: 100.4913,
    levelMeters: 2.08,
    status: "warning",
    updatedAt: "2026-05-26 10:07",
    summary: "พื้นที่ฝั่งธนฯ มีแนวโน้มรับผลกระทบก่อนในช่วงน้ำขึ้นสูง",
  },
  {
    id: "bang-kapi-east-drain",
    label: "แนวระบายน้ำบางกะปิ",
    districtCode: "1006",
    latitude: 13.7657,
    longitude: 100.6476,
    levelMeters: 1.88,
    status: "watch",
    updatedAt: "2026-05-26 10:06",
    summary: "ระดับน้ำเริ่มสูงในคลองหลัก เหมาะกับการ mock dashboard ฝั่งตะวันออกของเมือง",
  },
];
