import { LexicalEditor } from "lexical";
import {
    $getSelection,
    $isRangeSelection,
    $createParagraphNode,
    $createTextNode,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createRowNode } from "./nodes/RowNode";
import { $createColumnNode } from "./nodes/ColumnNode";

export type BlockCommand = {
    id: string;
    label: string;
    keywords: string[];
    icon: string;
    onSelect: (editor: LexicalEditor) => void;
};

export const blockCommands: BlockCommand[] = [
    {
        id: "paragraph",
        label: "Paragraph",
        keywords: ["paragraph", "p", "text"],
        icon: "¶",
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createParagraphNode());
                }
            });
        },
    },
    {
        id: "h1",
        label: "Heading 1",
        keywords: ["heading", "h1", "title"],
        icon: "H1",
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createHeadingNode("h1"));
                }
            });
        },
    },
    {
        id: "h2",
        label: "Heading 2",
        keywords: ["heading", "h2", "subtitle"],
        icon: "H2",
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createHeadingNode("h2"));
                }
            });
        },
    },
    {
        id: "quote",
        label: "Quote",
        keywords: ["quote", "blockquote", "citation"],
        icon: '"',
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createQuoteNode());
                }
            });
        },
    },
    {
        id: "ul",
        label: "Bulleted List",
        keywords: ["bullet", "list", "ul", "unordered"],
        icon: "•",
        onSelect: (editor) => {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
    },
    {
        id: "ol",
        label: "Numbered List",
        keywords: ["number", "list", "ol", "ordered"],
        icon: "1.",
        onSelect: (editor) => {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        },
    },
    {
        id: "row-2",
        label: "2 Columns",
        keywords: ["row", "columns", "2", "two", "layout"],
        icon: "||",
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    // Create row with columns
                    const row = $createRowNode("1:1");
                    const col1 = $createColumnNode("1");
                    const col2 = $createColumnNode("1");

                    // Add paragraph nodes to columns
                    const para1 = $createParagraphNode();
                    const para2 = $createParagraphNode();
                    para1.append($createTextNode(""));
                    para2.append($createTextNode(""));

                    col1.append(para1);
                    col2.append(para2);
                    row.append(col1, col2);

                    // Get the current block node
                    const anchor = selection.anchor;
                    let node = anchor.getNode();

                    // Traverse up to find the top-level block
                    while (node) {
                        const parent = node.getParent();
                        if (!parent || parent.getType() === 'root') {
                            break;
                        }
                        node = parent;
                    }

                    // Insert row after current block
                    if (node) {
                        node.insertAfter(row);
                        // Move selection to first column
                        para1.select();
                    }
                }
            });
        },
    },
    {
        id: "row-3",
        label: "3 Columns",
        keywords: ["row", "columns", "3", "three", "layout"],
        icon: "|||",
        onSelect: (editor) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    // Create row with columns
                    const row = $createRowNode("1:1:1");
                    const col1 = $createColumnNode("1");
                    const col2 = $createColumnNode("1");
                    const col3 = $createColumnNode("1");

                    // Add paragraph nodes to columns
                    const para1 = $createParagraphNode();
                    const para2 = $createParagraphNode();
                    const para3 = $createParagraphNode();
                    para1.append($createTextNode(""));
                    para2.append($createTextNode(""));
                    para3.append($createTextNode(""));

                    col1.append(para1);
                    col2.append(para2);
                    col3.append(para3);
                    row.append(col1, col2, col3);

                    // Get the current block node
                    const anchor = selection.anchor;
                    let node = anchor.getNode();

                    // Traverse up to find the top-level block
                    while (node) {
                        const parent = node.getParent();
                        if (!parent || parent.getType() === 'root') {
                            break;
                        }
                        node = parent;
                    }

                    // Insert row after current block
                    if (node) {
                        node.insertAfter(row);
                        // Move selection to first column
                        para1.select();
                    }
                }
            });
        },
    },
];
