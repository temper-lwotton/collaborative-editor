import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Dialog from "@radix-ui/react-dialog";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";

export function FloatingLinkEditor() {
    const [editor] = useLexicalComposerContext();
    const [isOpen, setIsOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const [isEditingLink, setIsEditingLink] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return mergeRegister(
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const node = selection.anchor.getNode();
                        const parent = node.getParent();
                        if ($isLinkNode(parent)) {
                            setLinkUrl(parent.getURL());
                            setIsEditingLink(true);
                        } else if ($isLinkNode(node)) {
                            setLinkUrl(node.getURL());
                            setIsEditingLink(true);
                        } else {
                            setIsEditingLink(false);
                        }
                    }
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor]);

    const handleInsertLink = useCallback(() => {
        if (!linkUrl.trim()) return;

        editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
        setIsOpen(false);
        setLinkUrl("");
    }, [editor, linkUrl]);

    const handleRemoveLink = useCallback(() => {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        setIsOpen(false);
        setLinkUrl("");
    }, [editor]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setLinkUrl("");
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Trigger asChild>
                <button
                    className="floating-toolbar__button"
                    onClick={() => {
                        const selection = editor.getEditorState().read(() => $getSelection());
                        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
                            setIsOpen(true);
                        }
                    }}
                    title="Insert Link"
                >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <path
                            d="M4.5 6.5C4.5 5.67157 5.17157 5 6 5H9C9.82843 5 10.5 5.67157 10.5 6.5C10.5 7.32843 9.82843 8 9 8H6C5.17157 8 4.5 7.32843 4.5 6.5ZM6 4C4.61929 4 3.5 5.11929 3.5 6.5C3.5 7.88071 4.61929 9 6 9H9C10.3807 9 11.5 7.88071 11.5 6.5C11.5 5.11929 10.3807 4 9 4H6ZM8.5 8.5C8.5 9.32843 7.82843 10 7 10H4C3.17157 10 2.5 9.32843 2.5 8.5C2.5 7.67157 3.17157 7 4 7H7C7.82843 7 8.5 7.67157 8.5 8.5ZM4 6C2.61929 6 1.5 7.11929 1.5 8.5C1.5 9.88071 2.61929 11 4 11H7C8.38071 11 9.5 9.88071 9.5 8.5C9.5 7.11929 8.38071 6 7 6H4Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="link-editor__overlay" />
                <Dialog.Content className="link-editor__content">
                    <Dialog.Title className="link-editor__title">
                        {isEditingLink ? "Edit Link" : "Insert Link"}
                    </Dialog.Title>
                    <Dialog.Description className="link-editor__description">
                        Enter the URL you want to link to
                    </Dialog.Description>

                    <div className="link-editor__field">
                        <label className="link-editor__label" htmlFor="url">
                            URL
                        </label>
                        <input
                            ref={inputRef}
                            id="url"
                            className="link-editor__input"
                            type="url"
                            placeholder="https://example.com"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleInsertLink();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <div className="link-editor__actions">
                        {isEditingLink && (
                            <button
                                type="button"
                                className="link-editor__button link-editor__button--danger"
                                onClick={handleRemoveLink}
                            >
                                Remove Link
                            </button>
                        )}
                        <Dialog.Close asChild>
                            <button type="button" className="link-editor__button link-editor__button--secondary">
                                Cancel
                            </button>
                        </Dialog.Close>
                        <button
                            type="button"
                            className="link-editor__button link-editor__button--primary"
                            onClick={handleInsertLink}
                            disabled={!linkUrl.trim()}
                        >
                            {isEditingLink ? "Update" : "Insert"}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="link-editor__close" aria-label="Close">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path
                                    d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
