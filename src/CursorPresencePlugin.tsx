import React, { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCollaborationContext } from "@lexical/react/LexicalCollaborationContext";
import {
    $getSelection,
    $isRangeSelection,
    COMMAND_PRIORITY_LOW,
    SELECTION_CHANGE_COMMAND,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import type { Awareness } from "y-protocols/awareness";

type CursorData = {
    clientId: number;
    name: string;
    color: string;
    anchorKey: string | null;
    anchorOffset: number;
    focusKey: string | null;
    focusOffset: number;
};

export function CursorPresencePlugin() {
    const [editor] = useLexicalComposerContext();
    const { provider } = useCollaborationContext() as any;
    const [cursors, setCursors] = useState<CursorData[]>([]);

    useEffect(() => {
        if (!provider) return;

        const awareness: Awareness = provider.awareness;

        const updateCursors = () => {
            const states = awareness.getStates();
            const allCursors: CursorData[] = [];

            states.forEach((state: any, clientId: number) => {
                if (clientId === awareness.clientID) return; // Skip self
                if (!state || !state.cursor) return;

                allCursors.push({
                    clientId,
                    name: state.user?.name || `User ${clientId}`,
                    color: state.user?.color || "#666",
                    ...state.cursor,
                });
            });

            setCursors(allCursors);
        };

        awareness.on("change", updateCursors);

        // Update cursor position when selection changes
        const unregister = mergeRegister(
            editor.registerUpdateListener(() => {
                editor.getEditorState().read(() => {
                    const selection = $getSelection();

                    if ($isRangeSelection(selection)) {
                        const cursorData = {
                            anchorKey: selection.anchor.key,
                            anchorOffset: selection.anchor.offset,
                            focusKey: selection.focus.key,
                            focusOffset: selection.focus.offset,
                        };

                        awareness.setLocalStateField("cursor", cursorData);
                    } else {
                        awareness.setLocalStateField("cursor", null);
                    }
                });
            }),

            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    editor.getEditorState().read(() => {
                        const selection = $getSelection();

                        if ($isRangeSelection(selection)) {
                            const cursorData = {
                                anchorKey: selection.anchor.key,
                                anchorOffset: selection.anchor.offset,
                                focusKey: selection.focus.key,
                                focusOffset: selection.focus.offset,
                            };

                            awareness.setLocalStateField("cursor", cursorData);
                        } else {
                            awareness.setLocalStateField("cursor", null);
                        }
                    });
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );

        updateCursors();

        return () => {
            awareness.off("change", updateCursors);
            unregister();
        };
    }, [editor, provider]);

    return (
        <>
            {cursors.map((cursor) => (
                <RemoteCursor key={cursor.clientId} cursor={cursor} />
            ))}
        </>
    );
}

function RemoteCursor({ cursor }: { cursor: CursorData }) {
    const [editor] = useLexicalComposerContext();
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const updatePosition = () => {
            if (!cursor.anchorKey) {
                setPosition(null);
                return;
            }

            const anchorElement = editor.getElementByKey(cursor.anchorKey);
            if (!anchorElement) {
                setPosition(null);
                return;
            }

            // Get the text node
            const textNode = anchorElement.childNodes[0];
            if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
                setPosition(null);
                return;
            }

            // Create a range to measure cursor position
            const range = document.createRange();
            try {
                range.setStart(textNode, Math.min(cursor.anchorOffset, textNode.textContent?.length || 0));
                range.setEnd(textNode, Math.min(cursor.anchorOffset, textNode.textContent?.length || 0));

                const rect = range.getBoundingClientRect();
                const editorRoot = editor.getRootElement();
                const editorRect = editorRoot?.getBoundingClientRect();

                if (rect && editorRect) {
                    setPosition({
                        top: rect.top - editorRect.top,
                        left: rect.left - editorRect.left,
                    });
                }
            } catch (e) {
                setPosition(null);
            }
        };

        updatePosition();

        // Update on editor changes
        const unregister = editor.registerUpdateListener(() => {
            updatePosition();
        });

        return unregister;
    }, [editor, cursor]);

    if (!position) {
        return null;
    }

    return (
        <div
            className="remote-cursor"
            style={{
                position: "absolute",
                top: `${position.top}px`,
                left: `${position.left}px`,
                pointerEvents: "none",
                zIndex: 100,
            }}
        >
            <div
                className="remote-cursor__caret"
                style={{
                    backgroundColor: cursor.color,
                }}
            />
            <div
                className="remote-cursor__label"
                style={{
                    backgroundColor: cursor.color,
                }}
            >
                {cursor.name}
            </div>
        </div>
    );
}
