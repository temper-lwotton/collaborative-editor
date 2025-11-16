// server.ts
import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class YjsServer implements Party.Server {
    constructor(readonly room: Party.Room) {}

    onConnect(connection: Party.Connection) {
        return onConnect(connection, this.room, {
            // For PoC we skip persistence; later:
            // persist: { mode: "snapshot" },
        });
    }
}
