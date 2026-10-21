// Tipe yang dipakai bersama oleh browser dan server.

export type Settings = {
  normalMin: number;
  otLimitHrs: number;
  target: number;
  gradeA: number;
  gradeB: number;
  gradeC: number;
  stkiHighPct: number;
  stkiLowPct: number;
};

export type MasterCategory = { id: number; name: string; process: string; area: string; ngGroupId: number | null };
export type MasterPart = { id: number; categoryId: number; name: string; type: string; stki: number };
export type MasterMachine = {
  id: number;
  categoryId: number;
  mcNo: string;
  line: string;
  mainPart: string;
  canSwitchTo: string;
};
export type MasterLostTimeType = { id: number; name: string; group: "LOST_TIME" | "ANOTHER_JOB" };
export type MasterMember = { id: number; nik: string; name: string; area: string };
export type MasterNgGroup = { id: number; name: string; codes: string[] }; // codes[0] = NG1

export type MasterData = {
  categories: MasterCategory[];
  parts: MasterPart[];
  machines: MasterMachine[];
  lostTimeTypes: MasterLostTimeType[];
  members: MasterMember[];
  ngGroups: MasterNgGroup[];
  settings: Settings;
};

/** Nilai MC: id mesin, "-" (tidak pakai mesin), atau null (belum dipilih). */
export type MachineChoice = number | "-" | null;

export type PartRowInput = {
  categoryId: number | null;
  partId: number | null;
  machineId: MachineChoice;
  qtyNormal: number | null;
  minNormal: number | null;
  qtyOt: number | null;
  minOt: number | null;
  lot: string;
  oiban: string;
  ng: (number | null)[]; // panjang 10
};

export type LostRowInput = {
  lostTimeTypeId: number | null;
  minutes: number | null;
  note: string;
};

export type SubmissionInput = {
  workDate: string;
  memberId: number | null;
  parts: PartRowInput[];
  lostTimes: LostRowInput[];
};

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type SubmissionView = {
  id: string;
  workDate: string;
  memberId: number;
  memberName: string;
  memberNik: string;
  submittedAt: string;
  status: SubmissionStatus;
  leaderName: string | null;
  decidedAt: string | null;
  leaderNote: string | null;
  needsCheck: boolean;
  warnings: string[];
  parts: {
    categoryName: string;
    partName: string;
    type: string;
    mcNo: string;
    qtyNormal: number;
    minNormal: number;
    qtyOt: number;
    minOt: number;
    lot: string;
    oiban: string;
    ng: { label: string; qty: number }[];
  }[];
  lostTimes: { name: string; group: string; minutes: number; note: string }[];
  totals: { qty: number; minNormal: number; minOt: number; lostMin: number; ng: number };
};
