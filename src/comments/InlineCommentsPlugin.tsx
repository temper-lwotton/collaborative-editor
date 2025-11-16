import React, { useEffect, useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Popover from "@radix-ui/react-popover";
import * as Y from "yjs";
import { $isCommentNode } from "../nodes/CommentNode";
import { $getNodeByKey } from "lexical";

type CommentData = {
    id: string;
    text: string;
    author: string;
    createdAt: number;
    resolved?: boolean;
};

type InlineComment = CommentData & {
    position: { top: number; left: number };
    highlightKey: string;
};

type InlineCommentsPluginProps = {
    doc: Y.Doc | null;
};

export function InlineCommentsPlugin({ doc }: InlineCommentsPluginProps) {
    const [editor] = useLexicalComposerContext();
    const [inlineComments, setInlineComments] = useState<InlineComment[]>([]);
    const [openCommentId, setOpenCommentId] = useState<string | null>(null);

    // Calculate positions for all comments
    const updatePositions = useCallback(() => {
        if (!doc) return;

        const commentsMap: Y.Map<Y.Map<unknown>> = doc.getMap("commentsMap");
        const positions: InlineComment[] = [];

        editor.getEditorState().read(() => {
            commentsMap.forEach((commentYMap, commentId) => {
                const comment = {
                    id: commentId,
                    text: (commentYMap.get("text") as string) ?? "",
                    author: (commentYMap.get("author") as string) ?? "Unknown",
                    createdAt: (commentYMap.get("createdAt") as number) ?? Date.now(),
                    resolved: (commentYMap.get("resolved") as boolean) ?? false,
                };

                // Skip resolved comments
                if (comment.resolved) return;

                // Find the first CommentNode with this commentId
                const nodeKey = (commentYMap.get("nodeKey") as string) ?? null;
                if (!nodeKey) return;

                try {
                    const node = $getNodeByKey(nodeKey);
                    if (!node || !$isCommentNode(node)) return;

                    const domElement = editor.getElementByKey(nodeKey);
                    if (!domElement) return;

                    const rect = domElement.getBoundingClientRect();
                    const editorRoot = editor.getRootElement();
                    const editorRect = editorRoot?.getBoundingClientRect();

                    if (rect && editorRect) {
                        positions.push({
                            ...comment,
                            position: {
                                top: rect.top - editorRect.top,
                                left: editorRect.width + 20, // Position to the right of editor
                            },
                            highlightKey: nodeKey,
                        });
                    }
                } catch (e) {
                    // Node might not exist anymore
                }
            });
        });

        setInlineComments(positions);
    }, [doc, editor]);

    useEffect(() => {
        if (!doc) return;

        const commentsMap: Y.Map<Y.Map<unknown>> = doc.getMap("commentsMap");

        // Update positions when comments change
        const observer = () => {
            updatePositions();
        };

        commentsMap.observe(observer);

        // Update positions on editor changes
        const unregister = editor.registerUpdateListener(() => {
            updatePositions();
        });

        // Initial update
        updatePositions();

        // Update on window resize
        window.addEventListener("resize", updatePositions);
        window.addEventListener("scroll", updatePositions);

        return () => {
            commentsMap.unobserve(observer);
            unregister();
            window.removeEventListener("resize", updatePositions);
            window.removeEventListener("scroll", updatePositions);
        };
    }, [doc, editor, updatePositions]);

    const handleResolve = useCallback(
        (commentId: string) => {
            if (!doc) return;

            const commentsMap: Y.Map<Y.Map<unknown>> = doc.getMap("commentsMap");
            const commentYMap = commentsMap.get(commentId);
            if (commentYMap) {
                doc.transact(() => {
                    commentYMap.set("resolved", true);
                });
            }
            setOpenCommentId(null);
        },
        [doc]
    );

    const handleHighlightHover = useCallback((commentId: string, isEntering: boolean) => {
        // Could add visual feedback when hovering over highlights
    }, []);

    return (
        <>
            {inlineComments.map((comment) => (
                <Popover.Root
                    key={comment.id}
                    open={openCommentId === comment.id}
                    onOpenChange={(open) => setOpenCommentId(open ? comment.id : null)}
                >
                    <Popover.Trigger asChild>
                        <button
                            className="inline-comment"
                            style={{
                                position: "absolute",
                                top: `${comment.position.top}px`,
                                left: `${comment.position.left}px`,
                            }}
                            onMouseEnter={() => handleHighlightHover(comment.id, true)}
                            onMouseLeave={() => handleHighlightHover(comment.id, false)}
                        >
                            <div className="inline-comment__avatar">
                                {comment.author.charAt(0).toUpperCase()}
                            </div>
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content
                            className="inline-comment-popover"
                            side="right"
                            align="start"
                            sideOffset={8}
                        >
                            <div className="inline-comment-popover__header">
                                <div className="inline-comment-popover__author">
                                    {comment.author}
                                </div>
                                <div className="inline-comment-popover__time">
                                    {new Date(comment.createdAt).toLocaleString()}
                                </div>
                            </div>
                            <div className="inline-comment-popover__text">{comment.text}</div>
                            <div className="inline-comment-popover__actions">
                                <button
                                    className="inline-comment-popover__button inline-comment-popover__button--resolve"
                                    onClick={() => handleResolve(comment.id)}
                                >
                                    Resolve
                                </button>
                            </div>
                            <Popover.Arrow className="inline-comment-popover__arrow" />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            ))}
        </>
    );
}
