import type {
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedLexicalNode,
    Spread,
} from "lexical";
import { $applyNodeReplacement, TextNode } from "lexical";

export type SerializedCommentNode = Spread<
    {
        commentId: string;
    },
    SerializedLexicalNode
>;

export class CommentNode extends TextNode {
    __commentId: string;

    static getType(): string {
        return "comment";
    }

    static clone(node: CommentNode): CommentNode {
        return new CommentNode(node.__text, node.__commentId, node.__key);
    }

    constructor(text: string, commentId: string, key?: NodeKey) {
        super(text, key);
        this.__commentId = commentId;
    }

    getCommentId(): string {
        return this.__commentId;
    }

    setCommentId(commentId: string): void {
        const writable = this.getWritable();
        writable.__commentId = commentId;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const element = super.createDOM(config);
        element.classList.add("comment-highlight");
        element.setAttribute("data-comment-id", this.__commentId);
        return element;
    }

    updateDOM(
        prevNode: CommentNode,
        dom: HTMLElement,
        config: EditorConfig
    ): boolean {
        const updated = super.updateDOM(prevNode, dom, config);
        if (prevNode.__commentId !== this.__commentId) {
            dom.setAttribute("data-comment-id", this.__commentId);
        }
        return updated;
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement("span");
        element.classList.add("comment-highlight");
        element.setAttribute("data-comment-id", this.__commentId);
        element.textContent = this.__text;
        return { element };
    }

    static importDOM(): DOMConversionMap | null {
        return {
            span: (domNode: HTMLElement) => {
                if (!domNode.hasAttribute("data-comment-id")) {
                    return null;
                }
                return {
                    conversion: convertCommentElement,
                    priority: 1,
                };
            },
        };
    }

    static importJSON(serializedNode: SerializedCommentNode): CommentNode {
        const node = $createCommentNode(serializedNode.text, serializedNode.commentId);
        node.setFormat(serializedNode.format);
        node.setDetail(serializedNode.detail);
        node.setMode(serializedNode.mode);
        node.setStyle(serializedNode.style);
        return node;
    }

    exportJSON(): SerializedCommentNode {
        return {
            ...super.exportJSON(),
            commentId: this.__commentId,
            type: "comment",
            version: 1,
        };
    }

    isToken(): boolean {
        return false;
    }
}

function convertCommentElement(domNode: HTMLElement): DOMConversionOutput | null {
    const commentId = domNode.getAttribute("data-comment-id");
    if (commentId) {
        const node = $createCommentNode(domNode.textContent || "", commentId);
        return {
            node,
        };
    }
    return null;
}

export function $createCommentNode(text: string, commentId: string): CommentNode {
    return $applyNodeReplacement(new CommentNode(text, commentId));
}

export function $isCommentNode(
    node: LexicalNode | null | undefined
): node is CommentNode {
    return node instanceof CommentNode;
}
