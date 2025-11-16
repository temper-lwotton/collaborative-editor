import React, { useCallback, useEffect, useState, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getSelection,
    $isRangeSelection,
    $createParagraphNode,
    $createTextNode,
    COMMAND_PRIORITY_LOW,
    KEY_ARROW_DOWN_COMMAND,
    KEY_ARROW_UP_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND,
    TextNode,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { mergeRegister } from "@lexical/utils";
import { createPortal } from "react-dom";

type SlashCommand = {
    id: string;
    label: string;
    keywords: string[];
    icon: string;
    onSelect: () => void;
};

export function SlashCommandsPlugin() {
    const [editor] = useLexicalComposerContext();
    const [isOpen, setIsOpen] = useState(false);
    const [queryString, setQueryString] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const commands: SlashCommand[] = [
        {
            id: "paragraph",
            label: "Paragraph",
            keywords: ["paragraph", "p", "text"],
            icon: "¶",
            onSelect: () => {
                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () => $createParagraphNode());
                    }
                });
            },
        },
        {
            id: "h1",
            label: "Heading 1",
            keywords: ["heading", "h1", "title"],
            icon: "H1",
            onSelect: () => {
                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () => $createHeadingNode("h1"));
                    }
                });
            },
        },
        {
            id: "h2",
            label: "Heading 2",
            keywords: ["heading", "h2", "subtitle"],
            icon: "H2",
            onSelect: () => {
                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () => $createHeadingNode("h2"));
                    }
                });
            },
        },
        {
            id: "quote",
            label: "Quote",
            keywords: ["quote", "blockquote", "citation"],
            icon: '"',
            onSelect: () => {
                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        $setBlocksType(selection, () => $createQuoteNode());
                    }
                });
            },
        },
        {
            id: "ul",
            label: "Bulleted List",
            keywords: ["bullet", "list", "ul", "unordered"],
            icon: "•",
            onSelect: () => {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            },
        },
        {
            id: "ol",
            label: "Numbered List",
            keywords: ["number", "list", "ol", "ordered"],
            icon: "1.",
            onSelect: () => {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            },
        },
    ];

    const filteredCommands = commands.filter((command) =>
        command.keywords.some((keyword) =>
            keyword.toLowerCase().includes(queryString.toLowerCase())
        )
    );

    const closeMenu = useCallback(() => {
        setIsOpen(false);
        setQueryString("");
        setSelectedIndex(0);
    }, []);

    const selectCommand = useCallback(
        (index: number) => {
            const command = filteredCommands[index];
            if (command) {
                editor.update(() => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        // Remove the slash command text
                        const anchor = selection.anchor;
                        const node = anchor.getNode();
                        if (node instanceof TextNode) {
                            const text = node.getTextContent();
                            const slashIndex = text.lastIndexOf("/");
                            if (slashIndex !== -1) {
                                node.setTextContent(text.substring(0, slashIndex));
                            }
                        }
                    }
                });

                command.onSelect();
                closeMenu();
            }
        },
        [editor, filteredCommands, closeMenu]
    );

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    const selection = $getSelection();

                    if ($isRangeSelection(selection) && selection.isCollapsed()) {
                        const anchor = selection.anchor;
                        const node = anchor.getNode();

                        if (node instanceof TextNode) {
                            const text = node.getTextContent();
                            const offset = anchor.offset;

                            // Find the last "/" before the cursor
                            const beforeCursor = text.substring(0, offset);
                            const slashIndex = beforeCursor.lastIndexOf("/");

                            if (slashIndex !== -1) {
                                // Check if there's no space between "/" and cursor
                                const afterSlash = beforeCursor.substring(slashIndex + 1);
                                if (!/\s/.test(afterSlash)) {
                                    const domNode = editor.getElementByKey(node.getKey());
                                    if (domNode) {
                                        const domSelection = window.getSelection();
                                        if (domSelection && domSelection.rangeCount > 0) {
                                            const range = domSelection.getRangeAt(0);
                                            const rect = range.getBoundingClientRect();

                                            setPosition({
                                                top: rect.bottom + window.scrollY + 5,
                                                left: rect.left + window.scrollX,
                                            });
                                        }
                                    }

                                    setQueryString(afterSlash);
                                    setIsOpen(true);
                                    setSelectedIndex(0);
                                    return;
                                }
                            }
                        }
                    }

                    setIsOpen(false);
                });
            }),

            editor.registerCommand(
                KEY_ARROW_DOWN_COMMAND,
                (event) => {
                    if (isOpen) {
                        event.preventDefault();
                        setSelectedIndex((prev) =>
                            prev < filteredCommands.length - 1 ? prev + 1 : 0
                        );
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),

            editor.registerCommand(
                KEY_ARROW_UP_COMMAND,
                (event) => {
                    if (isOpen) {
                        event.preventDefault();
                        setSelectedIndex((prev) =>
                            prev > 0 ? prev - 1 : filteredCommands.length - 1
                        );
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),

            editor.registerCommand(
                KEY_ENTER_COMMAND,
                (event) => {
                    if (isOpen && filteredCommands.length > 0) {
                        event.preventDefault();
                        selectCommand(selectedIndex);
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),

            editor.registerCommand(
                KEY_ESCAPE_COMMAND,
                (event) => {
                    if (isOpen) {
                        event.preventDefault();
                        closeMenu();
                        return true;
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, isOpen, filteredCommands, selectedIndex, selectCommand, closeMenu]);

    if (!isOpen || filteredCommands.length === 0) {
        return null;
    }

    return createPortal(
        <div
            ref={menuRef}
            className="slash-menu"
            style={{
                position: "absolute",
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            <div className="slash-menu__header">
                {queryString ? `Search: "${queryString}"` : "Basic blocks"}
            </div>
            <div className="slash-menu__list">
                {filteredCommands.map((command, index) => (
                    <button
                        key={command.id}
                        className={`slash-menu__item ${
                            index === selectedIndex ? "slash-menu__item--selected" : ""
                        }`}
                        onClick={() => selectCommand(index)}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        <span className="slash-menu__icon">{command.icon}</span>
                        <span className="slash-menu__label">{command.label}</span>
                    </button>
                ))}
            </div>
        </div>,
        document.body
    );
}
