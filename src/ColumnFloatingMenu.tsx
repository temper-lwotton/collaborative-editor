import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Toolbar from "@radix-ui/react-toolbar";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
    $getSelection,
    $isRangeSelection,
    $getNodeByKey,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    NodeKey,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { $isColumnNode } from "./nodes/ColumnNode";
import { $isRowNode } from "./nodes/RowNode";

export function ColumnFloatingMenu() {
    const [editor] = useLexicalComposerContext();
    const menuRef = useRef<HTMLDivElement>(null);
    const [isShown, setIsShown] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [selectedColumnKey, setSelectedColumnKey] = useState<NodeKey | null>(null);
    const [canMoveLeft, setCanMoveLeft] = useState(false);
    const [canMoveRight, setCanMoveRight] = useState(false);

    const updateMenu = useCallback(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
            setIsShown(false);
            return;
        }

        // Check if selection encompasses a column
        const nodes = selection.getNodes();
        let columnNode = null;
        let columnKey: NodeKey | null = null;

        // Look for a ColumnNode in the selection or traverse up to find one
        for (const node of nodes) {
            let currentNode = node;
            while (currentNode) {
                if ($isColumnNode(currentNode)) {
                    columnNode = currentNode;
                    columnKey = currentNode.getKey();
                    break;
                }
                const parent = currentNode.getParent();
                if (!parent || parent.getType() === 'root') {
                    break;
                }
                currentNode = parent;
            }
            if (columnNode) break;
        }

        if (!columnNode || !columnKey) {
            setIsShown(false);
            return;
        }

        // Check if the column's parent is a row
        const parent = columnNode.getParent();
        if (!parent || !$isRowNode(parent)) {
            setIsShown(false);
            return;
        }

        // Get column's position in the row
        const siblings = parent.getChildren();
        const index = siblings.indexOf(columnNode);

        setCanMoveLeft(index > 0);
        setCanMoveRight(index < siblings.length - 1);
        setSelectedColumnKey(columnKey);

        // Position the menu above the column
        const domNode = editor.getElementByKey(columnKey);
        if (!domNode) {
            setIsShown(false);
            return;
        }

        const rect = domNode.getBoundingClientRect();
        const menuElem = menuRef.current;

        if (menuElem) {
            const menuRect = menuElem.getBoundingClientRect();
            setPosition({
                top: rect.top - menuRect.height - 10 + window.scrollY,
                left: rect.left + rect.width / 2 - menuRect.width / 2 + window.scrollX,
            });
        } else {
            setPosition({
                top: rect.top - 50 + window.scrollY,
                left: rect.left + rect.width / 2 - 50 + window.scrollX,
            });
        }

        setIsShown(true);
    }, [editor]);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateMenu();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateMenu();
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, updateMenu]);

    const moveColumnLeft = () => {
        if (!selectedColumnKey) return;

        editor.update(() => {
            const columnNode = $getNodeByKey(selectedColumnKey);
            if (!columnNode || !$isColumnNode(columnNode)) return;

            const parent = columnNode.getParent();
            if (!parent || !$isRowNode(parent)) return;

            const siblings = parent.getChildren();
            const index = siblings.indexOf(columnNode);

            if (index <= 0) return; // Already at the leftmost position

            const prevSibling = siblings[index - 1];
            columnNode.insertBefore(prevSibling);
        });
    };

    const moveColumnRight = () => {
        if (!selectedColumnKey) return;

        editor.update(() => {
            const columnNode = $getNodeByKey(selectedColumnKey);
            if (!columnNode || !$isColumnNode(columnNode)) return;

            const parent = columnNode.getParent();
            if (!parent || !$isRowNode(parent)) return;

            const siblings = parent.getChildren();
            const index = siblings.indexOf(columnNode);

            if (index === -1 || index >= siblings.length - 1) return; // Already at the rightmost position

            const nextSibling = siblings[index + 1];
            columnNode.insertAfter(nextSibling);
        });
    };

    if (!isShown) {
        return null;
    }

    return createPortal(
        <Tooltip.Provider delayDuration={300}>
            <div
                ref={menuRef}
                className="column-floating-menu"
                style={{
                    position: "absolute",
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                }}
            >
                <Toolbar.Root className="column-floating-menu__root" aria-label="Column options">
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="column-floating-menu__button"
                                onClick={moveColumnLeft}
                                disabled={!canMoveLeft}
                                aria-label="Move Column Left"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="column-floating-menu__tooltip" sideOffset={5}>
                                Move Left
                                <Tooltip.Arrow className="column-floating-menu__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <div className="column-floating-menu__label">Column</div>

                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="column-floating-menu__button"
                                onClick={moveColumnRight}
                                disabled={!canMoveRight}
                                aria-label="Move Column Right"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="column-floating-menu__tooltip" sideOffset={5}>
                                Move Right
                                <Tooltip.Arrow className="column-floating-menu__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </Toolbar.Root>
            </div>
        </Tooltip.Provider>,
        document.body
    );
}
