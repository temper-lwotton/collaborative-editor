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

export type RowLayout = "1:1" | "1:2" | "2:1" | "1:1:1" | "1:2:1" | "1:1:1:1";

export type SerializedRowNode = Spread<
    {
        layout: RowLayout;
    },
    SerializedElementNode
>;

export class RowNode extends ElementNode {
    __layout: RowLayout;

    static getType(): string {
        return "row";
    }

    static clone(node: RowNode): RowNode {
        return new RowNode(node.__layout, node.__key);
    }

    constructor(layout: RowLayout = "1:1", key?: NodeKey) {
        super(key);
        this.__layout = layout;
    }

    getLayout(): RowLayout {
        return this.__layout;
    }

    setLayout(layout: RowLayout): void {
        const writable = this.getWritable();
        writable.__layout = layout;
    }

    createDOM(config: EditorConfig): HTMLElement {
        const element = document.createElement("div");
        element.classList.add("editor-row");
        element.setAttribute("data-layout", this.__layout);
        return element;
    }

    updateDOM(prevNode: RowNode, dom: HTMLElement): boolean {
        if (prevNode.__layout !== this.__layout) {
            dom.setAttribute("data-layout", this.__layout);
        }
        return false;
    }

    exportDOM(): DOMExportOutput {
        const element = document.createElement("div");
        element.classList.add("editor-row");
        element.setAttribute("data-layout", this.__layout);
        return { element };
    }

    static importDOM(): DOMConversionMap | null {
        return {
            div: (domNode: HTMLElement) => {
                if (!domNode.classList.contains("editor-row")) {
                    return null;
                }
                return {
                    conversion: convertRowElement,
                    priority: 1,
                };
            },
        };
    }

    static importJSON(serializedNode: SerializedRowNode): RowNode {
        const node = $createRowNode(serializedNode.layout);
        node.setFormat(serializedNode.format);
        node.setIndent(serializedNode.indent);
        node.setDirection(serializedNode.direction);
        return node;
    }

    exportJSON(): SerializedRowNode {
        return {
            ...super.exportJSON(),
            layout: this.__layout,
            type: "row",
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

function convertRowElement(domNode: HTMLElement): DOMConversionOutput | null {
    const layout = (domNode.getAttribute("data-layout") || "1:1") as RowLayout;
    const node = $createRowNode(layout);
    return {
        node,
    };
}

export function $createRowNode(layout: RowLayout = "1:1"): RowNode {
    return $applyNodeReplacement(new RowNode(layout));
}

export function $isRowNode(node: LexicalNode | null | undefined): node is RowNode {
    return node instanceof RowNode;
}
