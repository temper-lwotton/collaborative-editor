import type { InitialConfigType } from "@lexical/react/LexicalComposer";

export const lexicalInitialConfig: InitialConfigType = {
  namespace: "LexicalCollabPOC",
  editorState: null, // CollaborationPlugin will handle initial state
  theme: {},
  onError(error: Error) {
    throw error;
  },
  nodes: []
};
