import React, { useEffect, useState } from "react";
import { useCollaborationContext } from "@lexical/react/LexicalCollaborationContext";
import type { Awareness } from "y-protocols/awareness";

type PresenceUser = {
  clientId: number;
  name: string;
  color: string;
};

function awarenessToUsers(awareness: Awareness): PresenceUser[] {
  const states = awareness.getStates();
  const users: PresenceUser[] = [];
  states.forEach((state: any, clientId: number) => {
    if (!state || !state.user) return;
    users.push({
      clientId,
      name: state.user.name,
      color: state.user.color
    });
  });
  return users;
}

export function PresenceLayer() {
  const { provider } = useCollaborationContext() as any;
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!provider) return;

    const awareness: Awareness = provider.awareness;

    const handleChange = () => {
      setUsers(awarenessToUsers(awareness));
    };

    awareness.on("change", handleChange);

    const randomColor =
      "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    const randomName = "User " + Math.floor(Math.random() * 1000);

    awareness.setLocalStateField("user", {
      name: randomName,
      color: randomColor
    });

    handleChange();

    return () => {
      awareness.off("change", handleChange);
      awareness.setLocalState(null);
    };
  }, [provider]);

  if (!users.length) return null;

  return (
    <div className="presence-bar">
      {users.map((user) => (
        <div
          key={user.clientId}
          className="presence-badge"
          style={{ borderColor: user.color }}
        >
          <span
            className="presence-avatar"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="presence-name">{user.name}</span>
        </div>
      ))}
    </div>
  );
}
