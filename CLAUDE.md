# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a proof-of-concept collaborative rich text editor built with:
- **Lexical** - Meta's extensible text editor framework
- **Yjs** - CRDT library for real-time collaboration
- **PartyKit** - Multiplayer server infrastructure
- **React** - UI framework
- **Vite** - Build tool and dev server

The application demonstrates real-time collaborative editing with presence awareness and a comments sidebar that syncs across clients.

## Development Commands

### Running the Application
```bash
# Start Vite dev server (frontend on port 5173)
npm run dev

# Start PartyKit server (WebSocket server on port 1999)
npm run party:dev
```

**Important**: You need BOTH servers running simultaneously for collaboration to work:
- Vite serves the React app
- PartyKit handles real-time synchronization via WebSockets

### Building and Deployment
```bash
# Build the frontend for production
npm run build

# Preview production build locally
npm run preview

# Deploy PartyKit server
npm run party:deploy
```

## Architecture

### Core Collaboration Flow

The application uses a **single shared Y.Doc** for both editor content and comments, enabling true real-time collaboration:

1. **Provider Factory** (src/Editor.tsx:26-45): Creates a `YPartyKitProvider` that connects a Yjs document to the PartyKit WebSocket server
2. **CollaborationPlugin**: Lexical's official plugin that syncs editor state with the Y.Doc
3. **Shared State**: The same Y.Doc instance is exposed to both the editor and the CommentsSidebar

### Key Components

**src/Editor.tsx** - Root component that:
- Creates the shared Y.Doc via `providerFactory`
- Wraps everything in `LexicalCollaboration` and `LexicalComposer` contexts
- Renders the main editor and comments sidebar side-by-side
- Uses document ID `"demo-document-1"` (hardcoded for PoC)

**src/presence/PresenceLayer.tsx** - Shows connected users:
- Accesses `provider.awareness` from the collaboration context
- Generates random user names and colors on mount
- Displays avatars for all connected clients

**src/comments/CommentsSidebar.tsx** - Collaborative commenting:
- Subscribes to `doc.getArray("comments")` for real-time comment updates
- Stores comment selections as `{ anchorKey, anchorOffset, focusKey, focusOffset }`
- Clicking a comment re-creates the selection in the editor and scrolls to it
- All comments require an active text selection

**src/FloatingToolbar.tsx** - Selection-based formatting toolbar:
- Appears above selected text (Gutenberg-style)
- Uses React portals for proper positioning
- **Radix UI Components**: Built with Radix Toolbar, ToggleGroup, Tooltip, DropdownMenu, and Separator
- **Tooltips**: Hover over any button to see its function
- **Inline formatting**: Bold, italic, underline, code (with active state indicators)
- **Link button**: Opens FloatingLinkEditor dialog
- **List buttons**: Insert bulleted or numbered lists
- **Block type dropdown**: Change paragraph to H1, H2, or Quote via dropdown menu
- Tracks active formats and updates button states automatically
- Smooth animations for tooltips and dropdown menus
- Automatically hides when selection is collapsed

**src/FloatingLinkEditor.tsx** - Link insertion and editing dialog:
- Radix Dialog component for modal link editing
- Insert new links or edit existing ones
- Remove link button when editing
- Auto-detects when cursor is on a link
- Keyboard shortcut: Enter to confirm, Escape to cancel

**src/SlashCommandsPlugin.tsx** - Notion-style slash commands:
- Type `/` to open command menu
- Auto-filters commands as you type
- Keyboard navigation: Arrow keys to select, Enter to insert, Escape to close
- Commands: paragraph, h1, h2, quote, bulleted list, numbered list
- Menu appears at cursor position

**src/CursorPresencePlugin.tsx** - Real-time cursor presence:
- Shows other users' cursors in the editor
- Displays user name and color above cursor
- Syncs via Yjs awareness protocol
- Blinking cursor animation
- Updates in real-time as users move their cursors

**src/InspectorControls.tsx** - Block configuration panel (Gutenberg-style):
- Right sidebar that shows settings for the currently selected block
- Tracks selection changes and displays block type
- **Color Settings**: Background color and text color pickers with hex input
- **Spacing Controls**: Radix UI sliders for margin and padding (top, bottom, left, right)
- Live value display shows current pixel value
- Sliders range from 0-100px with smooth dragging
- Applies inline styles directly to block DOM elements
- Uses Radix UI Accordion for collapsible sections

**server.ts** - PartyKit server:
- Implements `YjsServer` using `y-partykit`'s `onConnect` helper
- Currently has no persistence (comments/content lost on server restart)
- Configured to run on port 1999 (partykit.json)

### Yjs Integration Details

- **Editor content**: Stored in the Y.Doc root structure by Lexical's CollaborationPlugin
- **Comments**: Stored in `doc.getArray("comments")` as Y.Maps with fields: `id`, `text`, `author`, `createdAt`, `selection`
- **Presence**: Managed by the provider's awareness protocol with `user: { name, color }` state

### Client Connection

The PartyKit provider connects to `localhost:1999` (src/Editor.tsx:39). This is hardcoded and should be environment-configured for production use.

## Features

### Text Formatting
- **Inline**: Bold, italic, underline, code
- **Block types**: Paragraph, Heading 1, Heading 2, Quote
- **Lists**: Bulleted lists, numbered lists
- **Links**: Insert and edit hyperlinks

### Collaboration
- **Real-time sync**: All text changes sync via Yjs + PartyKit
- **Cursor presence**: See other users' cursors with their names
- **User avatars**: See who's online in the presence bar
- **Comments**: Add comments to selected text, synced across users

### User Experience
- **Floating toolbar**: Context-sensitive toolbar appears on text selection
- **Slash commands**: Type `/` to insert blocks (Notion-style)
- **Inspector controls**: Right sidebar for block styling (colors, spacing)
- **Keyboard shortcuts**: Enter to confirm dialogs, Escape to cancel, Arrow keys in menus

## Important Notes

- **No Persistence**: The PartyKit server currently skips persistence (server.ts:11). All data is lost when the server restarts.
- **Single Document**: All clients connect to the same document (`"demo-document-1"`). Multi-document support would require routing/document IDs.
- **Selection Storage**: Comments store Lexical node keys, which may become invalid if the referenced nodes are deleted.
- **No Authentication**: User names are randomly generated. Real apps would need proper identity management.
- **Inline Styles**: Inspector control styles are applied as inline styles and are NOT synced across clients (local-only customization).

## Common Patterns

### Adding a New Lexical Plugin

Register plugins inside `LexicalComposer` in src/Editor.tsx:
```tsx
<LexicalComposer initialConfig={initialConfig}>
  {/* existing plugins */}
  <YourNewPlugin />
</LexicalComposer>
```

### Accessing Collaboration State

Use the collaboration context hook:
```tsx
const { provider } = useCollaborationContext();
const awareness = provider?.awareness;
```

### Modifying Shared Yjs Data

Always use transactions for atomic updates:
```tsx
doc.transact(() => {
  const array = doc.getArray("comments");
  array.push([newComment]);
});
```

### Styling Blocks with InspectorControls

The inspector controls apply inline styles to blocks. Styles are applied directly to the DOM element and persist in the editor but are **not synced** across clients. For persistent styling:

1. Extend node classes to support custom attributes
2. Store style data in the node's data field
3. Serialize/deserialize custom attributes with the collaboration plugin

Current implementation uses inline styles for quick prototyping.
