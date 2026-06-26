import type {
  Pet as ContractPet,
  PetStatus,
  Position,
  ResponseLevel,
  RoomSnapshot as ContractRoomSnapshot,
  WorldEvent as ContractWorldEvent,
  WorldObject as ContractWorldObject
} from "@pet-sanctuary/contracts";

export type { PetStatus, ResponseLevel };
export type Point = Position;
export type SanctuaryContractSnapshot = ContractRoomSnapshot;
export type SanctuaryContractEvent = ContractWorldEvent;
export type SanctuaryContractPet = ContractPet;
export type SanctuaryContractObject = ContractWorldObject;

export type SpeechBubble = {
  message: string;
  createdAt: string;
  expiresAt?: string;
};

export type Pet = {
  id: ContractPet["id"];
  name: ContractPet["name"];
  avatar: string;
  accent: string;
  tagline: ContractPet["tagline"];
  traits: string[];
  personalitySummary: ContractPet["personalitySummary"];
  speakingStyle: ContractPet["speakingStyle"];
  status: PetStatus;
  responseLevel: ResponseLevel;
  karma: ContractPet["karma"];
  permissions: string[];
  position: Point;
  memoryStub: string;
  currentSpeech?: SpeechBubble;
};

export type RoomObject = {
  id: string;
  label: string;
  kind: "desk" | "seat" | "plant" | "lamp" | "notice" | "rug";
  position: Point;
  width: number;
  height: number;
  state?: string;
};

export type WorldEvent = {
  id: string;
  type:
    | "RoomSeeded"
    | "RoomNotice"
    | "SimulationTick"
    | "SimulationPaused"
    | "SimulationResumed"
    | "PetObserved"
    | "PetMoved"
    | "PetSaid"
    | "PetAskedHelp"
    | "PetOfferedHelp"
    | "PetStartedWork"
    | "PetBuiltObject"
    | "PetDecoratedObject"
    | "PetRequestedSkill"
    | "PetReflected"
    | "ActionRejected"
    | "SystemNotice";
  summary: string;
  createdAt: string;
  actorPetId?: string;
  responseLevel?: ResponseLevel;
  significance: "low" | "medium" | "high";
  payload?: {
    message?: string;
    targetPetId?: string;
    objectId?: string;
  };
};

export type RoomSnapshot = {
  roomId: string;
  roomName: string;
  grid: {
    width: number;
    height: number;
  };
  paused: boolean;
  pets: Pet[];
  objects: RoomObject[];
  events: WorldEvent[];
  updatedAt: string;
};

export type SocketConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type SnapshotSource = "api" | "socket" | "seed-fallback";
