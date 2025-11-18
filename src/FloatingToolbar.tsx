import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCollaborationContext } from "@lexical/react/LexicalCollaborationContext";
import * as Toolbar from "@radix-ui/react-toolbar";
import * as Separator from "@radix-ui/react-separator";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import {
    $getSelection,
    $isRangeSelection,
    $createParagraphNode,
    FORMAT_TEXT_COMMAND,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    $getNodeByKey,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from "@lexical/rich-text";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND, $isListNode } from "@lexical/list";
import { mergeRegister } from "@lexical/utils";
import { FloatingLinkEditor } from "./FloatingLinkEditor";
import { CommentInputPopover } from "./comments/CommentInputPopover";

export function FloatingToolbar() {
    const [editor] = useLexicalComposerContext();
    const { yjsDocMap } = useCollaborationContext() as any;
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [isShown, setIsShown] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [activeFormats, setActiveFormats] = useState<string[]>([]);
    const [isCommentPopoverOpen, setIsCommentPopoverOpen] = useState(false);
    const [commentAnchorPosition, setCommentAnchorPosition] = useState<{ top: number; left: number } | null>(null);

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        const nativeSelection = window.getSelection();
        const toolbarElem = toolbarRef.current;
        const rootElement = editor.getRootElement();

        if (
            !$isRangeSelection(selection) ||
            !nativeSelection ||
            nativeSelection.isCollapsed ||
            !rootElement ||
            !rootElement.contains(nativeSelection.anchorNode)
        ) {
            setIsShown(false);
            return;
        }

        // Update active formats
        const formats: string[] = [];
        if (selection.hasFormat('bold')) formats.push('bold');
        if (selection.hasFormat('italic')) formats.push('italic');
        if (selection.hasFormat('underline')) formats.push('underline');
        if (selection.hasFormat('code')) formats.push('code');
        setActiveFormats(formats);

        const domRange = nativeSelection.getRangeAt(0);
        const rangeRect = domRange.getBoundingClientRect();

        if (!toolbarElem) {
            setIsShown(true);
            return;
        }

        const toolbarRect = toolbarElem.getBoundingClientRect();

        const newPosition = {
            top: rangeRect.top - toolbarRect.height - 10 + window.scrollY,
            left: rangeRect.left + rangeRect.width / 2 - toolbarRect.width / 2,
        };

        setPosition(newPosition);
        setIsShown(true);
    }, [editor]);

    useEffect(() => {
        const unregister = mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );

        return () => {
            unregister();
        };
    }, [editor, updateToolbar]);

    useEffect(() => {
        if (isShown && toolbarRef.current) {
            editor.getEditorState().read(() => {
                updateToolbar();
            });
        }
    }, [isShown, editor, updateToolbar]);

    const onClickFormat = (format: "bold" | "italic" | "underline" | "code") => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    };

    const onClickHeading = (tag: "h1" | "h2" | "paragraph" | "quote") => {
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                if (tag === "paragraph") {
                    $setBlocksType(selection, () => $createParagraphNode());
                } else if (tag === "quote") {
                    $setBlocksType(selection, () => $createQuoteNode());
                } else {
                    $setBlocksType(selection, () => $createHeadingNode(tag as HeadingTagType));
                }
            }
        });
    };

    const onClickComment = () => {
        const nativeSelection = window.getSelection();
        if (nativeSelection && nativeSelection.rangeCount > 0) {
            const range = nativeSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setCommentAnchorPosition({
                top: rect.bottom + window.scrollY,
                left: rect.right + window.scrollX,
            });
            setIsCommentPopoverOpen(true);
        }
    };

    const moveBlockUp = () => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const nodes = selection.getNodes();
            const anchorNode = nodes[0];

            // Get the top-level block node
            let blockNode = anchorNode;
            let parent = blockNode.getParent();

            while (parent && !parent.isRootNode()) {
                blockNode = parent;
                parent = parent.getParent();
            }

            if (!parent) return;

            const siblings = parent.getChildren();
            const index = siblings.indexOf(blockNode);

            if (index <= 0) return; // Already at the top

            const prevSibling = siblings[index - 1];
            blockNode.insertBefore(prevSibling);
        });
    };

    const moveBlockDown = () => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const nodes = selection.getNodes();
            const anchorNode = nodes[0];

            // Get the top-level block node
            let blockNode = anchorNode;
            let parent = blockNode.getParent();

            while (parent && !parent.isRootNode()) {
                blockNode = parent;
                parent = parent.getParent();
            }

            if (!parent) return;

            const siblings = parent.getChildren();
            const index = siblings.indexOf(blockNode);

            if (index === -1 || index >= siblings.length - 1) return; // Already at the bottom

            const nextSibling = siblings[index + 1];
            blockNode.insertAfter(nextSibling);
        });
    };

    // Get the Y.Doc from yjsDocMap
    const doc = yjsDocMap && yjsDocMap.size > 0 ? Array.from(yjsDocMap.values())[0] : null;

    if (!isShown) {
        return null;
    }

    const toolbarContent = (
        <Tooltip.Provider delayDuration={300}>
            <div
                ref={toolbarRef}
                className="floating-toolbar"
                style={{
                    position: "absolute",
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                }}
            >
                <Toolbar.Root className="floating-toolbar__root" aria-label="Formatting options">
                    {/* Text Formatting */}
                    <ToggleGroup.Root
                        type="multiple"
                        value={activeFormats}
                        onValueChange={() => {}} // Handled by Lexical commands
                        className="floating-toolbar__group"
                    >
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <ToggleGroup.Item
                                    value="bold"
                                    className="floating-toolbar__button"
                                    onClick={() => onClickFormat("bold")}
                                    aria-label="Bold"
                                >
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                        <path
                                            d="M5.10505 12C4.70805 12 4.4236 11.912 4.25171 11.736C4.0839 11.5559 4 11.2715 4 10.8827V4.11733C4 3.72033 4.08595 3.43588 4.25784 3.26398C4.43383 3.08799 4.71623 3 5.10505 3C6.42741 3 8.25591 3 9.02852 3C10.1373 3 11.0539 3.98153 11.0539 5.1846C11.0539 6.08501 10.6037 6.81855 9.70327 7.23602C10.8657 7.44851 11.5176 8.62787 11.5176 9.48128C11.5176 10.5125 10.9902 12 9.27734 12C8.77742 12 6.42626 12 5.10505 12ZM8.37891 8.00341H5.8V10.631H8.37891C8.9 10.631 9.6296 10.1211 9.6296 9.29877C9.6296 8.47643 8.9 8.00341 8.37891 8.00341ZM5.8 4.36903V6.69577H8.17969C8.53906 6.69577 9.27734 6.35939 9.27734 5.50002C9.27734 4.64064 8.48047 4.36903 8.17969 4.36903H5.8Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                </ToggleGroup.Item>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                    Bold
                                    <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <ToggleGroup.Item
                                    value="italic"
                                    className="floating-toolbar__button"
                                    onClick={() => onClickFormat("italic")}
                                    aria-label="Italic"
                                >
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                        <path
                                            d="M5.67494 3.50017C5.67494 3.25164 5.87641 3.05017 6.12494 3.05017H10.6249C10.8735 3.05017 11.0749 3.25164 11.0749 3.50017C11.0749 3.7487 10.8735 3.95017 10.6249 3.95017H9.00587L7.2309 11.05H8.87493C9.12345 11.05 9.32493 11.2515 9.32493 11.5C9.32493 11.7486 9.12345 11.95 8.87493 11.95H4.37493C4.12641 11.95 3.92493 11.7486 3.92493 11.5C3.92493 11.2515 4.12641 11.05 4.37493 11.05H5.99397L7.76894 3.95017H6.12494C5.87641 3.95017 5.67494 3.7487 5.67494 3.50017Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </ToggleGroup.Item>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                    Italic
                                    <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <ToggleGroup.Item
                                    value="underline"
                                    className="floating-toolbar__button"
                                    onClick={() => onClickFormat("underline")}
                                    aria-label="Underline"
                                >
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                        <path
                                            d="M5.00001 2.75C5.00001 2.47386 4.77615 2.25 4.50001 2.25C4.22387 2.25 4.00001 2.47386 4.00001 2.75V8.05C4.00001 9.983 5.56702 11.55 7.50001 11.55C9.433 11.55 11 9.983 11 8.05V2.75C11 2.47386 10.7762 2.25 10.5 2.25C10.2239 2.25 10 2.47386 10 2.75V8.05C10 9.43071 8.88072 10.55 7.50001 10.55C6.1193 10.55 5.00001 9.43071 5.00001 8.05V2.75ZM3.49998 13.1001C3.27906 13.1001 3.09998 13.2791 3.09998 13.5001C3.09998 13.721 3.27906 13.9001 3.49998 13.9001H11.5C11.7209 13.9001 11.9 13.721 11.9 13.5001C11.9 13.2791 11.7209 13.1001 11.5 13.1001H3.49998Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </ToggleGroup.Item>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                    Underline
                                    <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <ToggleGroup.Item
                                    value="code"
                                    className="floating-toolbar__button"
                                    onClick={() => onClickFormat("code")}
                                    aria-label="Code"
                                >
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                        <path
                                            d="M9.96424 2.68571C10.0668 2.42931 9.94209 2.13833 9.6857 2.03577C9.4293 1.93322 9.13832 2.05792 9.03576 2.31432L5.03576 12.3143C4.9332 12.5707 5.05791 12.8617 5.3143 12.9642C5.5707 13.0668 5.86168 12.9421 5.96424 12.6857L9.96424 2.68571ZM3.85355 5.14646C4.04882 5.34172 4.04882 5.6583 3.85355 5.85356L2.20711 7.50001L3.85355 9.14646C4.04882 9.34172 4.04882 9.6583 3.85355 9.85356C3.65829 10.0488 3.34171 10.0488 3.14645 9.85356L1.14645 7.85356C0.951184 7.6583 0.951184 7.34172 1.14645 7.14646L3.14645 5.14646C3.34171 4.9512 3.65829 4.9512 3.85355 5.14646ZM11.1464 5.14646C11.3417 4.9512 11.6583 4.9512 11.8536 5.14646L13.8536 7.14646C14.0488 7.34172 14.0488 7.6583 13.8536 7.85356L11.8536 9.85356C11.6583 10.0488 11.3417 10.0488 11.1464 9.85356C10.9512 9.6583 10.9512 9.34172 11.1464 9.14646L12.7929 7.50001L11.1464 5.85356C10.9512 5.6583 10.9512 5.34172 11.1464 5.14646Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </ToggleGroup.Item>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                    Code
                                    <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    </ToggleGroup.Root>

                    <Separator.Root
                        className="floating-toolbar__separator"
                        decorative
                        orientation="vertical"
                    />

                    {/* Link Editor */}
                    <FloatingLinkEditor />

                    <Separator.Root
                        className="floating-toolbar__separator"
                        decorative
                        orientation="vertical"
                    />

                    {/* Lists */}
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="floating-toolbar__button"
                                onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
                                aria-label="Bulleted List"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                Bulleted List
                                <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="floating-toolbar__button"
                                onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
                                aria-label="Numbered List"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M3.5 3C3.22386 3 3 3.22386 3 3.5C3 3.77614 3.22386 4 3.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H3.5ZM3 7.5C3 7.22386 3.22386 7 3.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H3.5C3.22386 8 3 7.77614 3 7.5ZM3 11.5C3 11.2239 3.22386 11 3.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H3.5C3.22386 12 3 11.7761 3 11.5ZM1.5 2.75C1.36193 2.75 1.25 2.86193 1.25 3V4C1.25 4.13807 1.36193 4.25 1.5 4.25C1.63807 4.25 1.75 4.13807 1.75 4V3.75H2C2.13807 3.75 2.25 3.63807 2.25 3.5C2.25 3.36193 2.13807 3.25 2 3.25H1.5V2.75ZM.75 7C.75 6.86193 .861929 6.75 1 6.75H2C2.13807 6.75 2.25 6.86193 2.25 7C2.25 7.13807 2.13807 7.25 2 7.25H1.25V7.5H2C2.13807 7.5 2.25 7.61193 2.25 7.75C2.25 7.88807 2.13807 8 2 8H1C.861929 8 .75 7.88807 .75 7.75V7ZM1 10.75C.861929 10.75 .75 10.8619 .75 11V12C.75 12.1381 .861929 12.25 1 12.25H2C2.13807 12.25 2.25 12.1381 2.25 12C2.25 11.8619 2.13807 11.75 2 11.75H1.25V11.5H2C2.13807 11.5 2.25 11.3881 2.25 11.25C2.25 11.1119 2.13807 11 2 11H1.25V10.75H1Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                Numbered List
                                <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <Separator.Root
                        className="floating-toolbar__separator"
                        decorative
                        orientation="vertical"
                    />

                    {/* Comment Button */}
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="floating-toolbar__button"
                                onClick={onClickComment}
                                aria-label="Add Comment"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M12.5 3H2.5C2.22386 3 2 3.22386 2 3.5V9.5C2 9.77614 2.22386 10 2.5 10H3V12.5C3 12.6326 3.05268 12.7598 3.14645 12.8536C3.24022 12.9473 3.36739 13 3.5 13C3.58075 13 3.65983 12.9781 3.72856 12.9373L6.19856 11.4373C6.28075 11.3905 6.37452 11.3602 6.47 11.3486C6.47637 11.3487 6.48275 11.349 6.48914 11.3494C6.49345 11.3497 6.49777 11.35 6.50209 11.35H12.5C12.7761 10 13 9.77614 13 9.5V3.5C13 3.22386 12.7761 3 12.5 3ZM12 9H6.5C6.48883 9 6.47768 9.00013 6.46655 9.00039C6.31765 9.00405 6.17122 9.04139 6.03856 9.10956L4 10.2987V10C4 9.72386 3.77614 9.5 3.5 9.5H3V4H12V9Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                Add Comment
                                <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <Separator.Root
                        className="floating-toolbar__separator"
                        decorative
                        orientation="vertical"
                    />

                    {/* Block Type Dropdown */}
                    <DropdownMenu.Root>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <DropdownMenu.Trigger className="floating-toolbar__button">
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                        <path
                                            d="M2.5 4.5C2.5 4.22386 2.72386 4 3 4H12C12.2761 4 12.5 4.22386 12.5 4.5C12.5 4.77614 12.2761 5 12 5H3C2.72386 5 2.5 4.77614 2.5 4.5ZM2.5 7.5C2.5 7.22386 2.72386 7 3 7H12C12.2761 7 12.5 7.22386 12.5 7.5C12.5 7.77614 12.2761 8 12 8H3C2.72386 8 2.5 7.77614 2.5 7.5ZM3 10C2.72386 10 2.5 10.2239 2.5 10.5C2.5 10.7761 2.72386 11 3 11H9C9.27614 11 9.5 10.7761 9.5 10.5C9.5 10.2239 9.27614 10 9 10H3Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    <svg width="10" height="10" viewBox="0 0 15 15" fill="none" style={{ marginLeft: 4 }}>
                                        <path
                                            d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z"
                                            fill="currentColor"
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </DropdownMenu.Trigger>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                    Change block type
                                    <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="floating-toolbar__dropdown" sideOffset={5}>
                                <DropdownMenu.Item
                                    className="floating-toolbar__dropdown-item"
                                    onSelect={() => onClickHeading("paragraph")}
                                >
                                    Paragraph
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className="floating-toolbar__dropdown-item"
                                    onSelect={() => onClickHeading("h1")}
                                >
                                    Heading 1
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                    className="floating-toolbar__dropdown-item"
                                    onSelect={() => onClickHeading("h2")}
                                >
                                    Heading 2
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="floating-toolbar__dropdown-separator" />
                                <DropdownMenu.Item
                                    className="floating-toolbar__dropdown-item"
                                    onSelect={() => onClickHeading("quote")}
                                >
                                    Quote
                                </DropdownMenu.Item>
                                <DropdownMenu.Arrow className="floating-toolbar__dropdown-arrow" />
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>

                    <Separator.Root
                        className="floating-toolbar__separator"
                        decorative
                        orientation="vertical"
                    />

                    {/* Move Up/Down Buttons */}
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="floating-toolbar__button"
                                onClick={moveBlockUp}
                                aria-label="Move Up"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711V12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5V3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                Move Up
                                <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <button
                                className="floating-toolbar__button"
                                onClick={moveBlockDown}
                                aria-label="Move Down"
                            >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path
                                        d="M7.5 2C7.77614 2 8 2.22386 8 2.5L8 11.2929L11.1464 8.14645C11.3417 7.95118 11.6583 7.95118 11.8536 8.14645C12.0488 8.34171 12.0488 8.65829 11.8536 8.85355L7.85355 12.8536C7.75979 12.9473 7.63261 13 7.5 13C7.36739 13 7.24021 12.9473 7.14645 12.8536L3.14645 8.85355C2.95118 8.65829 2.95118 8.34171 3.14645 8.14645C3.34171 7.95118 3.65829 7.95118 3.85355 8.14645L7 11.2929L7 2.5C7 2.22386 7.22386 2 7.5 2Z"
                                        fill="currentColor"
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="floating-toolbar__tooltip" sideOffset={5}>
                                Move Down
                                <Tooltip.Arrow className="floating-toolbar__tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </Toolbar.Root>
            </div>
        </Tooltip.Provider>
    );

    return (
        <>
            {createPortal(toolbarContent, document.body)}
            <CommentInputPopover
                doc={doc}
                isOpen={isCommentPopoverOpen}
                onOpenChange={setIsCommentPopoverOpen}
                anchorPosition={commentAnchorPosition}
            />
        </>
    );
}
