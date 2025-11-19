import React, { useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
    $getRoot,
    LexicalNode,
    ElementNode,
    TextNode,
    NodeKey,
    $getNodeByKey,
} from "lexical";
import { $isHeadingNode } from "@lexical/rich-text";
import { $isListNode, $isListItemNode } from "@lexical/list";
import { $isRowNode } from "./nodes/RowNode";
import { $isColumnNode } from "./nodes/ColumnNode";

type BlockTreeNode = {
    key: NodeKey;
    type: string;
    label: string;
    children: BlockTreeNode[];
    isLeaf: boolean;
};

function getNodeLabel(node: LexicalNode): string {
    const type = node.getType();

    if (type === "root") return "Document";
    if (type === "paragraph") return "Paragraph";
    if ($isHeadingNode(node)) return `Heading ${node.getTag().toUpperCase()}`;
    if (type === "quote") return "Quote";
    if ($isListNode(node)) {
        return node.getListType() === "bullet" ? "Bulleted List" : "Numbered List";
    }
    if ($isListItemNode(node)) return "List Item";
    if ($isRowNode(node)) {
        const layout = node.getLayout();
        return `Row (${layout})`;
    }
    if ($isColumnNode(node)) return "Column";
    if (type === "text") {
        const textNode = node as TextNode;
        const text = textNode.getTextContent().slice(0, 30);
        return text ? `"${text}${text.length === 30 ? "..." : ""}"` : "Empty Text";
    }
    if (type === "link") return "Link";
    if (type === "linebreak") return "Line Break";

    return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildTree(node: LexicalNode): BlockTreeNode {
    const key = node.getKey();
    const type = node.getType();
    const label = getNodeLabel(node);

    // Check if this is a leaf node (no meaningful children)
    const isLeaf = !node.isAttached() || !(node instanceof ElementNode) || node.getChildrenSize() === 0;

    const children: BlockTreeNode[] = [];

    if (!isLeaf && node instanceof ElementNode) {
        const childrenNodes = node.getChildren();
        for (const child of childrenNodes) {
            children.push(buildTree(child));
        }
    }

    return {
        key,
        type,
        label,
        children,
        isLeaf,
    };
}

function TreeNodeComponent({
    node,
    depth = 0,
    onSelectNode,
}: {
    node: BlockTreeNode;
    depth?: number;
    onSelectNode: (key: NodeKey) => void;
}) {
    const [isOpen, setIsOpen] = useState(depth < 2); // Auto-expand first 2 levels

    const hasChildren = node.children.length > 0;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
            setIsOpen(!isOpen);
        }
        onSelectNode(node.key);
    };

    const indent = depth * 16;

    if (!hasChildren) {
        // Leaf node - just a button
        return (
            <button
                className="block-hierarchy__item block-hierarchy__item--leaf"
                style={{ paddingLeft: `${indent + 8}px` }}
                onClick={handleClick}
            >
                <span className="block-hierarchy__icon">📄</span>
                <span className="block-hierarchy__label">{node.label}</span>
            </button>
        );
    }

    // Parent node - collapsible
    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
            <Collapsible.Trigger asChild>
                <button
                    className="block-hierarchy__item"
                    style={{ paddingLeft: `${indent + 8}px` }}
                    onClick={handleClick}
                >
                    <span className="block-hierarchy__chevron">
                        {isOpen ? (
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                                <path
                                    d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                                <path
                                    d="M6.15803 3.13523C5.95657 3.3241 5.94637 3.64052 6.13523 3.84197L9.56464 7.5L6.13523 11.158C5.94637 11.3595 5.95657 11.6759 6.15803 11.8648C6.35949 12.0536 6.67591 12.0434 6.86477 11.842L10.6148 7.84197C10.7951 7.64964 10.7951 7.35036 10.6148 7.15803L6.86477 3.15803C6.67591 2.95657 6.35949 2.94637 6.15803 3.13523Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                    </span>
                    <span className="block-hierarchy__icon">📁</span>
                    <span className="block-hierarchy__label">{node.label}</span>
                    <span className="block-hierarchy__count">({node.children.length})</span>
                </button>
            </Collapsible.Trigger>
            <Collapsible.Content>
                <div className="block-hierarchy__children">
                    {node.children.map((child) => (
                        <TreeNodeComponent
                            key={child.key}
                            node={child}
                            depth={depth + 1}
                            onSelectNode={onSelectNode}
                        />
                    ))}
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}

export function BlockHierarchy() {
    const [editor] = useLexicalComposerContext();
    const [tree, setTree] = useState<BlockTreeNode | null>(null);

    useEffect(() => {
        const updateTree = () => {
            editor.getEditorState().read(() => {
                const root = $getRoot();
                const treeData = buildTree(root);
                setTree(treeData);
            });
        };

        // Initial tree build
        updateTree();

        // Listen for editor updates
        const unregister = editor.registerUpdateListener(() => {
            updateTree();
        });

        return () => {
            unregister();
        };
    }, [editor]);

    const handleSelectNode = (key: NodeKey) => {
        editor.update(() => {
            const node = $getNodeByKey(key);
            if (node) {
                // Select the node
                if (node instanceof ElementNode) {
                    node.selectStart();
                } else if (node instanceof TextNode) {
                    node.select();
                }

                // Scroll into view
                const element = editor.getElementByKey(key);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }
        });
    };

    if (!tree) {
        return null;
    }

    return (
        <div className="block-hierarchy">
            <div className="block-hierarchy__header">
                <h3 className="block-hierarchy__title">Document Outline</h3>
            </div>
            <div className="block-hierarchy__content">
                {tree.children.length === 0 ? (
                    <div className="block-hierarchy__empty">No blocks yet</div>
                ) : (
                    tree.children.map((child) => (
                        <TreeNodeComponent
                            key={child.key}
                            node={child}
                            depth={0}
                            onSelectNode={handleSelectNode}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
