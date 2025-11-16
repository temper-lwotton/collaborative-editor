// src/comments/CommentsSidebar.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $getSelection,
    $isRangeSelection,
    $getNodeByKey,
    $setSelection,
    $createRangeSelection,
} from "lexical";
import * as Y from "yjs";

type CommentSelection = {
    anchorKey: string;
    anchorOffset: number;
    focusKey: string;
    focusOffset: number;
    text: string;
};

type CommentData = {
    id: string;
    text: string;
    author: string;
    createdAt: number;
    selection?: CommentSelection;
};

function mapFromY(map: Y.Map<unknown>): CommentData {
    const selectionRaw = map.get("selection") as
        | {
        anchorKey: string;
        anchorOffset: number;
        focusKey: string;
        focusOffset: number;
        text: string;
    }
        | undefined;

    return {
        id: (map.get("id") as string) ?? "",
        text: (map.get("text") as string) ?? "",
        author: (map.get("author") as string) ?? "Unknown",
        createdAt: (map.get("createdAt") as number) ?? Date.now(),
        selection: selectionRaw,
    };
}

type CommentsSidebarProps = {
    doc: Y.Doc | null;
};

export function CommentsSidebar({ doc }: CommentsSidebarProps) {
    const [editor] = useLexicalComposerContext();
    const [comments, setComments] = useState<CommentData[]>([]);
    const [draft, setDraft] = useState("");
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

    // Subscribe to Yjs comments array
    useEffect(() => {
        if (!doc) return;

        const commentsArray: Y.Array<Y.Map<unknown>> = doc.getArray("comments");

        const updateFromDoc = () => {
            try {
                const nextComments: CommentData[] = commentsArray
                    .toArray()
                    .map(mapFromY)
                    .sort((a, b) => a.createdAt - b.createdAt);

                setComments(nextComments);
            } catch {
                // Ignore Yjs "invalid access" noise during early init.
            }
        };

        // Initial load
        updateFromDoc();

        const observer = () => {
            updateFromDoc();
        };
        commentsArray.observe(observer);

        return () => {
            commentsArray.unobserve(observer);
        };
    }, [doc]);

    // Create a comment attached to the current selection
    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!doc || !draft.trim()) return;

            let selectionPayload: CommentSelection | undefined;

            editor.getEditorState().read(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection) && !selection.isCollapsed()) {
                    const anchor = selection.anchor;
                    const focus = selection.focus;
                    const text = selection.getTextContent();

                    selectionPayload = {
                        anchorKey: anchor.key,
                        anchorOffset: anchor.offset,
                        focusKey: focus.key,
                        focusOffset: focus.offset,
                        text,
                    };
                }
            });

            // Require a selection for now
            if (!selectionPayload) {
                // You could show a toast or message here if you like
                return;
            }

            const commentsArray: Y.Array<Y.Map<unknown>> = doc.getArray("comments");

            const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
            const author = `User-${doc.clientID.toString(36)}`;

            const map = new Y.Map<unknown>();
            map.set("id", id);
            map.set("text", draft.trim());
            map.set("author", author);
            map.set("createdAt", Date.now());
            map.set("selection", selectionPayload);

            doc.transact(() => {
                commentsArray.push([map]);
            });

            setDraft("");
        },
        [doc, draft, editor]
    );

    // When you click a comment, re-select its range in the editor and scroll to it
    const handleCommentClick = useCallback(
        (comment: CommentData) => {
            if (!comment.selection) return;

            setActiveCommentId(comment.id);

            const { anchorKey, anchorOffset, focusKey, focusOffset } =
                comment.selection;

            editor.update(() => {
                const anchorNode = $getNodeByKey(anchorKey);
                const focusNode = $getNodeByKey(focusKey);
                if (!anchorNode || !focusNode) return;

                const rangeSelection = $createRangeSelection();
                rangeSelection.setTextNodeRange(
                    anchorNode,
                    anchorOffset,
                    focusNode,
                    focusOffset
                );
                $setSelection(rangeSelection);
            });

            // Scroll the anchor DOM element into view (outside editor.update)
            const anchorElement = editor.getElementByKey(anchorKey);
            if (anchorElement) {
                anchorElement.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }
        },
        [editor]
    );

    return (
        <aside className="comments-sidebar">
            <div className="comments-sidebar__header">
                <h3 className="comments-sidebar__title">Comments</h3>
                <span className="comments-sidebar__count">{comments.length}</span>
            </div>

            <div className="comments-sidebar__list">
                {comments.length === 0 && (
                    <div className="comments-sidebar__empty">
                        No comments yet. Select some text in the editor and add a comment.
                    </div>
                )}
                {comments.map((comment) => (
                    <button
                        key={comment.id}
                        type="button"
                        className={
                            "comments-sidebar__item" +
                            (comment.id === activeCommentId
                                ? " comments-sidebar__item--active"
                                : "")
                        }
                        onClick={() => handleCommentClick(comment)}
                    >
                        <div className="comments-sidebar__meta">
              <span className="comments-sidebar__author">
                {comment.author}
              </span>
                            <span className="comments-sidebar__time">
                {new Date(comment.createdAt).toLocaleTimeString()}
              </span>
                        </div>

                        {comment.selection && (
                            <div className="comments-sidebar__selection">
                                “{comment.selection.text.slice(0, 120)}”
                            </div>
                        )}

                        <div className="comments-sidebar__text">{comment.text}</div>
                    </button>
                ))}
            </div>

            <form className="comments-sidebar__form" onSubmit={handleSubmit}>
        <textarea
            className="comments-sidebar__input"
            placeholder={
                doc
                    ? "Select some text in the editor, then add a comment…"
                    : "Connecting… (doc not ready yet)"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!doc}
        />
                <button
                    type="submit"
                    className="comments-sidebar__button"
                    disabled={!draft.trim() || !doc}
                >
                    Comment
                </button>
            </form>
        </aside>
    );
}
