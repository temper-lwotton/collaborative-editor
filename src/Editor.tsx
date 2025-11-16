// src/Editor.tsx
import React, { useMemo, useState } from "react";
import * as Y from "yjs";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListNode, ListItemNode } from "@lexical/list";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";

import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";

import YPartyKitProvider from "y-partykit/provider";

import { PresenceLayer } from "./presence/PresenceLayer";
import { CommentsSidebar } from "./comments/CommentsSidebar";
import { InlineCommentsPlugin } from "./comments/InlineCommentsPlugin";
import { FloatingToolbar } from "./FloatingToolbar";
import { InspectorControls } from "./InspectorControls";
import { SlashCommandsPlugin } from "./SlashCommandsPlugin";
import { CursorPresencePlugin } from "./CursorPresencePlugin";
import { CommentNode } from "./nodes/CommentNode";

import "./styles.css";

function EditorContent({ commentsDoc }: { commentsDoc: Y.Doc | null }) {
    return (
        <>
            <FloatingToolbar />
            <PresenceLayer />
            <InlineCommentsPlugin doc={commentsDoc} />

            <RichTextPlugin
                contentEditable={
                    <div className="editor-content-wrapper">
                        <ContentEditable className="editor-input" />
                    </div>
                }
                placeholder={
                    <div className="editor-placeholder">
                        Start typing… open another tab to see realtime sync.
                    </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
            />

            <HistoryPlugin />
            <LinkPlugin />
            <ListPlugin />
            <SlashCommandsPlugin />
            <CursorPresencePlugin />
        </>
    );
}

export function Editor() {
    // Shared Y.Doc used for both text + comments
    const [commentsDoc, setCommentsDoc] = useState<Y.Doc | null>(null);

    // Provider factory used by Lexical's CollaborationPlugin
    const providerFactory = useMemo(
        () =>
            (id: string, yjsDocMap: Map<string, Y.Doc>) => {
                // 1) Create a shared Yjs document
                const doc = new Y.Doc();

                // 2) Register with Lexical collaboration (so editor content syncs)
                yjsDocMap.set(id, doc);

                // 3) Expose to our CommentsSidebar
                setCommentsDoc(doc);

                // 4) Create PartyKit provider for this doc
                const provider = new YPartyKitProvider("localhost:1999", id, doc, {
                    connect: false, // CollaborationPlugin manages connect()
                });

                return provider;
            },
        []
    );

    const initialConfig = {
        namespace: "lexical-collab-demo",
        theme: {
            paragraph: "editor-paragraph",
            heading: {
                h1: "editor-heading-h1",
                h2: "editor-heading-h2",
            },
            quote: "editor-quote",
        },
        onError(error: Error) {
            console.error(error);
        },
        nodes: [
            HeadingNode,
            QuoteNode,
            LinkNode,
            AutoLinkNode,
            ListNode,
            ListItemNode,
            CommentNode,
        ],
    };

    return (
        <LexicalCollaboration>
            <LexicalComposer initialConfig={initialConfig}>
                <div className="editor-root">
                    <div className="editor-layout">
                        {/* Left: main editor */}
                        <div className="editor-inner">
                            <EditorContent commentsDoc={commentsDoc} />

                            <CollaborationPlugin
                                id="demo-document-1"
                                providerFactory={providerFactory}
                                shouldBootstrap={true}
                            />
                        </div>

                        {/* Middle: comments sidebar (shares Y.Doc with editor) */}
                        <CommentsSidebar doc={commentsDoc} />

                        {/* Right: Inspector Controls (Gutenberg-style) */}
                        <InspectorControls />
                    </div>
                </div>
            </LexicalComposer>
        </LexicalCollaboration>
    );
}
