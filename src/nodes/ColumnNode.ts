import type {
    DOMConversionMap,
    DOMConversionOutput,
    DOMExportOutput,
    EditorConfig,
    LexicalNode,
    NodeKey,
    SerializedElementNode,
    Spread,
} from "lexical";
import { $applyNodeReplacement, ElementNode } from "lexical";

export type SerializedColumnNode = Spread<
    {
        width?: string;
    },
    SerializedElementNode
>;

export class ColumnNode extends ElementNode {
    __width?: string;

    static getType(): string {
        return "column";
    }

    static clone(node: ColumnNode): ColumnNode {
        return new ColumnNode(node.__width, node.__key);
    }

    constructor(width?: string, key?: NodeKey) {
        super(key);
        this.__width = width;
    }

    getWidth(): string | undefined {
        return this.__width;
    }

    setWidth(width?: string): void {
        const writable = this.getWritable();
        writable.__width = width;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const element = document.createElement("div");
        element.classList.add("editor-column");
        if (this.__width) {
            element.style.flex = this.__width;
        }
        return element;
    }

    updateDOM(prevNode: ColumnNode, dom: HTMLElement): boolean {
        if (prevNode.__width !== this.__width) {
            if (this.__width) {
                dom.style.flex = this.__width;
            } else {
                dom.style.flex = "";
            }
        }
        return false;
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement("div");
        element.classList.add("editor-column");
        if (this.__width) {
            element.style.flex = this.__width;
        }
        return { element };
    }

    static importDOM(): DOMConversionMap | null {
        return {
            div: (domNode: HTMLElement) => {
                if (!domNode.classList.contains("editor-column")) {
                    return null;
                }
                return {
                    conversion: convertColumnElement,
                    priority: 1,
                };
            },
        };
    }

    static importJSON(serializedNode: SerializedColumnNode): ColumnNode {
        const node = $createColumnNode(serializedNode.width);
        node.setFormat(serializedNode.format);
        node.setIndent(serializedNode.indent);
        node.setDirection(serializedNode.direction);
        return node;
    }

    exportJSON(): SerializedColumnNode {
        return {
            ...super.exportJSON(),
            width: this.__width,
            type: "column",
            version: 1,
        };
    }

    canBeEmpty(): boolean {
        return false;
    }

    canInsertTextBefore(): boolean {
        return false;
    }

    canInsertTextAfter(): boolean {
        return false;
    }

    isShadowRoot(): boolean {
        return true;
    }

    isIsolated(): boolean {
        return true;
    }
}

function convertColumnElement(domNode: HTMLElement): DOMConversionOutput | null {
    const width = domNode.style.flex || undefined;
    const node = $createColumnNode(width);
    return {
        node,
    };
}

export function $createColumnNode(width?: string): ColumnNode {
    return $applyNodeReplacement(new ColumnNode(width));
}

export function $isColumnNode(
    node: LexicalNode | null | undefined
): node is ColumnNode {
    return node instanceof ColumnNode;
}
