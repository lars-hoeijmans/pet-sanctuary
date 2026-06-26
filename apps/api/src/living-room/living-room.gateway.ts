import {
  OnModuleDestroy
} from "@nestjs/common";
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayInit,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { LivingRoomService } from "./living-room.service.js";
import type { RoomUpdate } from "./api-types.js";

@WebSocketGateway({
  namespace: "/living-room",
  cors: {
    origin: "*"
  }
})
export class LivingRoomGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  private readonly server!: Server;

  private unsubscribe?: () => void;

  constructor(private readonly livingRoomService: LivingRoomService) {}

  afterInit(): void {
    this.unsubscribe = this.livingRoomService.subscribe((update) => {
      this.server.emit("room:update", update);
      if (update.event) {
        this.server.emit("room:event", update.event);
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const room = await this.livingRoomService.getMainRoom();
    client.emit("room:snapshot", room);
  }

  @SubscribeMessage("room:getSnapshot")
  async getSnapshot(@ConnectedSocket() client: Socket): Promise<void> {
    const room = await this.livingRoomService.getMainRoom();
    client.emit("room:snapshot", room);
  }

  handleDisconnect(): void {
    return;
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }
}
