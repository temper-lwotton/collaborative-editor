import React, { useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Popover from "@radix-ui/react-popover";
import * as Y from "yjs";
import {
    $getSelection,
    $isRangeSelection,
    $createTextNode,
} from "lexical";
import { $createCommentNode } from "../nodes/CommentNode";

type CommentInputPopoverProps = {
    doc: Y.Doc | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    anchorPosition: { top: number; left: number } | null;
};

export function CommentInputPopover({
    doc,
    isOpen,
    onOpenChange,
    anchorPosition,
}: CommentInputPopoverProps) {
    const [editor] = useLexicalComposerContext();
    const [commentText, setCommentText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!doc || !commentText.trim() || isSubmitting) return;

            setIsSubmitting(true);

            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || selection.isCollapsed()) {
                    setIsSubmitting(false);
                    return;
                }

                // Generate comment ID
                const commentId = `comment-${Date.now()}-${Math.floor(
                    Math.random() * 100000
                )}`;
                const author = `User-${doc.clientID.toString(36)}`;

                // Get selected text
                const selectedText = selection.getTextContent();

                // Extract selected nodes and wrap them with CommentNode
                const nodes = selection.extract();
                const firstNode = nodes[0];

                if (nodes.length > 0 && firstNode) {
                    // Create a comment node with the selected text
                    const commentNode = $createCommentNode(selectedText, commentId);

                    // Insert the comment node and remove the old nodes
                    nodes[0].replace(commentNode);
                    for (let i = 1; i < nodes.length; i++) {
                        nodes[i].remove();
                    }

                    // Store comment data in Yjs
                    const commentsMap: Y.Map<Y.Map<unknown>> = doc.getMap("commentsMap");

                    const commentYMap = new Y.Map<unknown>();
                    commentYMap.set("id", commentId);
                    commentYMap.set("text", commentText.trim());
                    commentYMap.set("author", author);
                    commentYMap.set("createdAt", Date.now());
                    commentYMap.set("resolved", false);
                    commentYMap.set("nodeKey", commentNode.getKey());

                    doc.transact(() => {
                        commentsMap.set(commentId, commentYMap);
                    });
                }
            });

            // Reset form
            setCommentText("");
            setIsSubmitting(false);
            onOpenChange(false);
        },
        [doc, commentText, editor, onOpenChange, isSubmitting]
    );

    const handleCancel = useCallback(() => {
        setCommentText("");
        onOpenChange(false);
    }, [onOpenChange]);

    if (!isOpen || !anchorPosition) {
        return null;
    }

    return (
        <div
            className="comment-input-anchor"
            style={{
                position: "absolute",
                top: `${anchorPosition.top}px`,
                left: `${anchorPosition.left}px`,
                pointerEvents: "none",
            }}
        >
            <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
                <Popover.Anchor />
                <Popover.Portal>
                    <Popover.Content
                        className="comment-input-popover"
                        side="right"
                        align="start"
                        sideOffset={8}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        style={{ pointerEvents: "auto" }}
                    >
                        <form onSubmit={handleSubmit}>
                            <div className="comment-input-popover__header">Add a comment</div>
                            <textarea
                                className="comment-input-popover__textarea"
                                placeholder="Type your comment..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                autoFocus
                                rows={3}
                            />
                            <div className="comment-input-popover__actions">
                                <button
                                    type="button"
                                    className="comment-input-popover__button comment-input-popover__button--cancel"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="comment-input-popover__button comment-input-popover__button--submit"
                                    disabled={!commentText.trim() || isSubmitting}
                                >
                                    Comment
                                </button>
                            </div>
                        </form>
                        <Popover.Arrow className="comment-input-popover__arrow" />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
}
