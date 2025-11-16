import React, { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Accordion from "@radix-ui/react-accordion";
import * as Slider from "@radix-ui/react-slider";
import * as RadioGroup from "@radix-ui/react-radio-group";
import {
    $getSelection,
    $isRangeSelection,
    $getNodeByKey,
    $createParagraphNode,
    $createTextNode,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    ElementNode,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { $isRowNode, RowLayout } from "./nodes/RowNode";
import { $isColumnNode, $createColumnNode } from "./nodes/ColumnNode";

type BlockStyles = {
    backgroundColor?: string;
    color?: string;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
};

export function InspectorControls() {
    const [editor] = useLexicalComposerContext();
    const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null);
    const [blockStyles, setBlockStyles] = useState<BlockStyles>({});
    const [blockType, setBlockType] = useState<string>("paragraph");
    const [isRowSelected, setIsRowSelected] = useState(false);
    const [rowLayout, setRowLayout] = useState<RowLayout>("1:1");
    const [columnCount, setColumnCount] = useState(0);

    // Helper function to parse style string into object
    const parseStyleString = (styleString: string): Record<string, string> => {
        const styleObj: Record<string, string> = {};
        if (!styleString) return styleObj;

        styleString.split(';').forEach(rule => {
            const [key, value] = rule.split(':').map(s => s.trim());
            if (key && value) {
                styleObj[key] = value;
            }
        });
        return styleObj;
    };

    const updateSelection = useCallback(() => {
        editor.getEditorState().read(() => {
            const selection = $getSelection();

            if ($isRangeSelection(selection)) {
                const anchor = selection.anchor;
                const anchorNode = anchor.getNode();

                // Get the top-level block element (direct child of root)
                let blockNode: ElementNode | null = null;

                // If we're in a text node, get its parent
                if (anchorNode.getType() === 'text') {
                    blockNode = anchorNode.getParent() as ElementNode;
                } else {
                    blockNode = anchorNode as ElementNode;
                }

                // Now traverse up to find the top-level block (child of root)
                while (blockNode) {
                    const parent = blockNode.getParent();

                    // Stop if parent is root or doesn't exist
                    if (!parent) {
                        break;
                    }

                    // Check if parent is root by checking its type
                    if (parent.getType() === 'root') {
                        // blockNode is a direct child of root - this is what we want
                        break;
                    }

                    blockNode = parent as ElementNode;
                }

                if (blockNode && blockNode.getType() !== 'root') {
                    const blockKey = blockNode.getKey();
                    const blockTypeValue = blockNode.getType();

                    setSelectedBlockKey(blockKey);
                    setBlockType(blockTypeValue);

                    // Check if it's a RowNode
                    if ($isRowNode(blockNode)) {
                        setIsRowSelected(true);
                        setRowLayout(blockNode.getLayout());
                        setColumnCount(blockNode.getChildren().length);
                    } else {
                        setIsRowSelected(false);
                    }

                    // Read existing styles from the node's style attribute
                    if (blockNode instanceof ElementNode) {
                        const styleString = blockNode.getStyle() || "";
                        const styleObj = parseStyleString(styleString);

                        const styles: BlockStyles = {
                            backgroundColor: styleObj['background-color'] || "",
                            color: styleObj['color'] || "",
                            marginTop: parseInt(styleObj['margin-top']) || 0,
                            marginBottom: parseInt(styleObj['margin-bottom']) || 0,
                            marginLeft: parseInt(styleObj['margin-left']) || 0,
                            marginRight: parseInt(styleObj['margin-right']) || 0,
                            paddingTop: parseInt(styleObj['padding-top']) || 0,
                            paddingBottom: parseInt(styleObj['padding-bottom']) || 0,
                            paddingLeft: parseInt(styleObj['padding-left']) || 0,
                            paddingRight: parseInt(styleObj['padding-right']) || 0,
                        };
                        setBlockStyles(styles);
                    }
                } else {
                    setSelectedBlockKey(null);
                    setIsRowSelected(false);
                }
            } else {
                setSelectedBlockKey(null);
            }
        });
    }, [editor]);

    useEffect(() => {
        // Initial selection update
        updateSelection();

        return mergeRegister(
            editor.registerUpdateListener(() => {
                updateSelection();
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateSelection();
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, updateSelection]);

    const applyRowLayout = useCallback((layout: RowLayout) => {
        if (!selectedBlockKey) return;

        editor.update(() => {
            const node = $getNodeByKey(selectedBlockKey);
            if (node && $isRowNode(node)) {
                node.setLayout(layout);

                // Update column widths based on layout
                const layoutMap: Record<RowLayout, string[]> = {
                    "1:1": ["1", "1"],
                    "1:2": ["1", "2"],
                    "2:1": ["2", "1"],
                    "1:1:1": ["1", "1", "1"],
                    "1:2:1": ["1", "2", "1"],
                    "1:1:1:1": ["1", "1", "1", "1"],
                };

                const children = node.getChildren();
                const widths = layoutMap[layout];

                // If we have a defined layout, use it
                if (widths) {
                    children.forEach((child, index) => {
                        if ($isColumnNode(child) && widths[index]) {
                            child.setWidth(widths[index]);
                        }
                    });
                } else {
                    // For custom column counts (5+), distribute equally
                    children.forEach((child) => {
                        if ($isColumnNode(child)) {
                            child.setWidth("1");
                        }
                    });
                }
            }
        });

        setRowLayout(layout);
    }, [selectedBlockKey, editor]);

    const addColumn = useCallback(() => {
        if (!selectedBlockKey) return;

        editor.update(() => {
            const node = $getNodeByKey(selectedBlockKey);
            if (node && $isRowNode(node)) {
                // Create a new column with a paragraph
                const newColumn = $createColumnNode("1");
                const para = $createParagraphNode();
                para.append($createTextNode(""));
                newColumn.append(para);

                // Append the new column to the row
                node.append(newColumn);

                // Update column count
                setColumnCount(node.getChildren().length);

                // Optionally update layout to distribute columns evenly
                const count = node.getChildren().length;
                if (count === 2) {
                    node.setLayout("1:1");
                    setRowLayout("1:1");
                } else if (count === 3) {
                    node.setLayout("1:1:1");
                    setRowLayout("1:1:1");
                } else if (count === 4) {
                    node.setLayout("1:1:1:1");
                    setRowLayout("1:1:1:1");
                }

                // Update all column widths to be equal
                const children = node.getChildren();
                children.forEach((child) => {
                    if ($isColumnNode(child)) {
                        child.setWidth("1");
                    }
                });
            }
        });
    }, [selectedBlockKey, editor]);

    const removeColumn = useCallback(() => {
        if (!selectedBlockKey) return;

        editor.update(() => {
            const node = $getNodeByKey(selectedBlockKey);
            if (node && $isRowNode(node)) {
                const children = node.getChildren();

                // Don't allow removing if only 1 column left
                if (children.length <= 1) {
                    return;
                }

                // Remove the last column
                const lastColumn = children[children.length - 1];
                if (lastColumn) {
                    lastColumn.remove();
                }

                // Update column count
                setColumnCount(node.getChildren().length);

                // Update layout based on remaining columns
                const count = node.getChildren().length;
                if (count === 2) {
                    node.setLayout("1:1");
                    setRowLayout("1:1");
                } else if (count === 3) {
                    node.setLayout("1:1:1");
                    setRowLayout("1:1:1");
                } else if (count === 4) {
                    node.setLayout("1:1:1:1");
                    setRowLayout("1:1:1:1");
                }

                // Update column widths
                const remainingChildren = node.getChildren();
                remainingChildren.forEach((child) => {
                    if ($isColumnNode(child)) {
                        child.setWidth("1");
                    }
                });
            }
        });
    }, [selectedBlockKey, editor]);

    const applyStyle = useCallback((styles: Partial<BlockStyles>) => {
        if (!selectedBlockKey) return;

        editor.update(() => {
            const node = $getNodeByKey(selectedBlockKey);
            if (node && node instanceof ElementNode) {
                const currentStyle = node.getStyle() || "";
                const styleObj = parseStyleString(currentStyle);

                // Update style object with new values
                if (styles.backgroundColor !== undefined) {
                    if (styles.backgroundColor) {
                        styleObj['background-color'] = styles.backgroundColor;
                    } else {
                        delete styleObj['background-color'];
                    }
                }
                if (styles.color !== undefined) {
                    if (styles.color) {
                        styleObj['color'] = styles.color;
                    } else {
                        delete styleObj['color'];
                    }
                }
                if (styles.marginTop !== undefined) {
                    styleObj['margin-top'] = `${styles.marginTop}px`;
                }
                if (styles.marginBottom !== undefined) {
                    styleObj['margin-bottom'] = `${styles.marginBottom}px`;
                }
                if (styles.marginLeft !== undefined) {
                    styleObj['margin-left'] = `${styles.marginLeft}px`;
                }
                if (styles.marginRight !== undefined) {
                    styleObj['margin-right'] = `${styles.marginRight}px`;
                }
                if (styles.paddingTop !== undefined) {
                    styleObj['padding-top'] = `${styles.paddingTop}px`;
                }
                if (styles.paddingBottom !== undefined) {
                    styleObj['padding-bottom'] = `${styles.paddingBottom}px`;
                }
                if (styles.paddingLeft !== undefined) {
                    styleObj['padding-left'] = `${styles.paddingLeft}px`;
                }
                if (styles.paddingRight !== undefined) {
                    styleObj['padding-right'] = `${styles.paddingRight}px`;
                }

                // Convert style object back to string
                const newStyleString = Object.entries(styleObj)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('; ');

                node.setStyle(newStyleString);
            }
        });

        setBlockStyles(prev => ({ ...prev, ...styles }));
    }, [selectedBlockKey, editor]);

    if (!selectedBlockKey) {
        return (
            <aside className="inspector-controls">
                <div className="inspector-controls__header">
                    <h3 className="inspector-controls__title">Block Settings</h3>
                </div>
                <div className="inspector-controls__empty">
                    Select a block to view its settings
                </div>
            </aside>
        );
    }

    return (
        <aside className="inspector-controls">
            <div className="inspector-controls__header">
                <h3 className="inspector-controls__title">Block Settings</h3>
                <span className="inspector-controls__type">{blockType}</span>
            </div>

            <Accordion.Root type="multiple" className="inspector-accordion" defaultValue={["layout", "colors", "spacing"]}>
                {/* Row Layout Settings - Only show for RowNode */}
                {isRowSelected && (
                    <Accordion.Item value="layout" className="inspector-accordion__item">
                        <Accordion.Header className="inspector-accordion__header">
                            <Accordion.Trigger className="inspector-accordion__trigger">
                                Column Layout
                                <svg className="inspector-accordion__icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                            </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Content className="inspector-accordion__content">
                            <div className="inspector-control">
                                <label className="inspector-control__label">Columns ({columnCount})</label>
                                <div className="inspector-column-controls">
                                    <button
                                        className="inspector-column-button"
                                        onClick={addColumn}
                                        title="Add Column"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <path
                                                d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Add Column
                                    </button>
                                    <button
                                        className="inspector-column-button"
                                        onClick={removeColumn}
                                        disabled={columnCount <= 1}
                                        title="Remove Column"
                                    >
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <path
                                                d="M2.25 7.5C2.25 7.22386 2.47386 7 2.75 7H12.25C12.5261 7 12.75 7.22386 12.75 7.5C12.75 7.77614 12.5261 8 12.25 8H2.75C2.47386 8 2.25 7.77614 2.25 7.5Z"
                                                fill="currentColor"
                                                fillRule="evenodd"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        Remove Column
                                    </button>
                                </div>
                            </div>

                            <div className="inspector-control">
                                <label className="inspector-control__label">Select Layout</label>
                                {columnCount === 1 ? (
                                    <div className="inspector-layout-message">
                                        Add more columns to change layout
                                    </div>
                                ) : (
                                    <RadioGroup.Root
                                        className="inspector-layout-group"
                                        value={rowLayout}
                                        onValueChange={(value) => applyRowLayout(value as RowLayout)}
                                    >
                                        {/* 2 Column Layouts */}
                                        {columnCount === 2 && (
                                        <>
                                            <div className="inspector-layout-option">
                                                <RadioGroup.Item
                                                    value="1:1"
                                                    className="inspector-layout-radio"
                                                    id="layout-1-1"
                                                >
                                                    <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                                </RadioGroup.Item>
                                                <label htmlFor="layout-1-1" className="inspector-layout-label">
                                                    <div className="inspector-layout-preview">
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    </div>
                                                    <span className="inspector-layout-name">50 / 50</span>
                                                </label>
                                            </div>

                                            <div className="inspector-layout-option">
                                                <RadioGroup.Item
                                                    value="1:2"
                                                    className="inspector-layout-radio"
                                                    id="layout-1-2"
                                                >
                                                    <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                                </RadioGroup.Item>
                                                <label htmlFor="layout-1-2" className="inspector-layout-label">
                                                    <div className="inspector-layout-preview">
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 2 }}></div>
                                                    </div>
                                                    <span className="inspector-layout-name">33 / 66</span>
                                                </label>
                                            </div>

                                            <div className="inspector-layout-option">
                                                <RadioGroup.Item
                                                    value="2:1"
                                                    className="inspector-layout-radio"
                                                    id="layout-2-1"
                                                >
                                                    <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                                </RadioGroup.Item>
                                                <label htmlFor="layout-2-1" className="inspector-layout-label">
                                                    <div className="inspector-layout-preview">
                                                        <div className="inspector-layout-preview__col" style={{ flex: 2 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    </div>
                                                    <span className="inspector-layout-name">66 / 33</span>
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    {/* 3 Column Layouts */}
                                    {columnCount === 3 && (
                                        <>
                                            <div className="inspector-layout-option">
                                                <RadioGroup.Item
                                                    value="1:1:1"
                                                    className="inspector-layout-radio"
                                                    id="layout-1-1-1"
                                                >
                                                    <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                                </RadioGroup.Item>
                                                <label htmlFor="layout-1-1-1" className="inspector-layout-label">
                                                    <div className="inspector-layout-preview">
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    </div>
                                                    <span className="inspector-layout-name">33 / 33 / 33</span>
                                                </label>
                                            </div>

                                            <div className="inspector-layout-option">
                                                <RadioGroup.Item
                                                    value="1:2:1"
                                                    className="inspector-layout-radio"
                                                    id="layout-1-2-1"
                                                >
                                                    <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                                </RadioGroup.Item>
                                                <label htmlFor="layout-1-2-1" className="inspector-layout-label">
                                                    <div className="inspector-layout-preview">
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 2 }}></div>
                                                        <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    </div>
                                                    <span className="inspector-layout-name">25 / 50 / 25</span>
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    {/* 4 Column Layout */}
                                    {columnCount === 4 && (
                                        <div className="inspector-layout-option">
                                            <RadioGroup.Item
                                                value="1:1:1:1"
                                                className="inspector-layout-radio"
                                                id="layout-1-1-1-1"
                                            >
                                                <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                            </RadioGroup.Item>
                                            <label htmlFor="layout-1-1-1-1" className="inspector-layout-label">
                                                <div className="inspector-layout-preview">
                                                    <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    <div className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                </div>
                                                <span className="inspector-layout-name">25 / 25 / 25 / 25</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* 5+ Columns - Equal distribution */}
                                    {columnCount >= 5 && (
                                        <div className="inspector-layout-option">
                                            <RadioGroup.Item
                                                value="1:1"
                                                className="inspector-layout-radio"
                                                id="layout-equal"
                                            >
                                                <RadioGroup.Indicator className="inspector-layout-radio-indicator" />
                                            </RadioGroup.Item>
                                            <label htmlFor="layout-equal" className="inspector-layout-label">
                                                <div className="inspector-layout-preview">
                                                    {Array.from({ length: Math.min(columnCount, 6) }).map((_, i) => (
                                                        <div key={i} className="inspector-layout-preview__col" style={{ flex: 1 }}></div>
                                                    ))}
                                                </div>
                                                <span className="inspector-layout-name">{columnCount} Equal Columns</span>
                                            </label>
                                        </div>
                                    )}
                                    </RadioGroup.Root>
                                )}
                            </div>
                        </Accordion.Content>
                    </Accordion.Item>
                )}

                {/* Color Settings */}
                <Accordion.Item value="colors" className="inspector-accordion__item">
                    <Accordion.Header className="inspector-accordion__header">
                        <Accordion.Trigger className="inspector-accordion__trigger">
                            Color Settings
                            <svg className="inspector-accordion__icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                            </svg>
                        </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content className="inspector-accordion__content">
                        <div className="inspector-control">
                            <label className="inspector-control__label">Background Color</label>
                            <div className="inspector-control__color-input">
                                <input
                                    type="color"
                                    value={blockStyles.backgroundColor || "#ffffff"}
                                    onChange={(e) => applyStyle({ backgroundColor: e.target.value })}
                                    className="inspector-color-picker"
                                />
                                <input
                                    type="text"
                                    value={blockStyles.backgroundColor || ""}
                                    onChange={(e) => applyStyle({ backgroundColor: e.target.value })}
                                    placeholder="#ffffff"
                                    className="inspector-text-input"
                                />
                                {blockStyles.backgroundColor && (
                                    <button
                                        onClick={() => applyStyle({ backgroundColor: "" })}
                                        className="inspector-button-clear"
                                        title="Clear"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="inspector-control">
                            <label className="inspector-control__label">Text Color</label>
                            <div className="inspector-control__color-input">
                                <input
                                    type="color"
                                    value={blockStyles.color || "#000000"}
                                    onChange={(e) => applyStyle({ color: e.target.value })}
                                    className="inspector-color-picker"
                                />
                                <input
                                    type="text"
                                    value={blockStyles.color || ""}
                                    onChange={(e) => applyStyle({ color: e.target.value })}
                                    placeholder="#000000"
                                    className="inspector-text-input"
                                />
                                {blockStyles.color && (
                                    <button
                                        onClick={() => applyStyle({ color: "" })}
                                        className="inspector-button-clear"
                                        title="Clear"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>
                    </Accordion.Content>
                </Accordion.Item>

                {/* Spacing Settings */}
                <Accordion.Item value="spacing" className="inspector-accordion__item">
                    <Accordion.Header className="inspector-accordion__header">
                        <Accordion.Trigger className="inspector-accordion__trigger">
                            Spacing
                            <svg className="inspector-accordion__icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                            </svg>
                        </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content className="inspector-accordion__content">
                        <div className="inspector-control-group">
                            <label className="inspector-control__label">Margin</label>
                            <div className="inspector-spacing-grid">
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Top</label>
                                        <span className="inspector-spacing-value">{blockStyles.marginTop || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.marginTop || 0]}
                                        onValueChange={(value) => applyStyle({ marginTop: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Bottom</label>
                                        <span className="inspector-spacing-value">{blockStyles.marginBottom || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.marginBottom || 0]}
                                        onValueChange={(value) => applyStyle({ marginBottom: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Left</label>
                                        <span className="inspector-spacing-value">{blockStyles.marginLeft || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.marginLeft || 0]}
                                        onValueChange={(value) => applyStyle({ marginLeft: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Right</label>
                                        <span className="inspector-spacing-value">{blockStyles.marginRight || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.marginRight || 0]}
                                        onValueChange={(value) => applyStyle({ marginRight: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                            </div>
                        </div>

                        <div className="inspector-control-group">
                            <label className="inspector-control__label">Padding</label>
                            <div className="inspector-spacing-grid">
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Top</label>
                                        <span className="inspector-spacing-value">{blockStyles.paddingTop || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.paddingTop || 0]}
                                        onValueChange={(value) => applyStyle({ paddingTop: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Bottom</label>
                                        <span className="inspector-spacing-value">{blockStyles.paddingBottom || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.paddingBottom || 0]}
                                        onValueChange={(value) => applyStyle({ paddingBottom: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Left</label>
                                        <span className="inspector-spacing-value">{blockStyles.paddingLeft || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.paddingLeft || 0]}
                                        onValueChange={(value) => applyStyle({ paddingLeft: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                                <div className="inspector-spacing-slider">
                                    <div className="inspector-spacing-slider__header">
                                        <label className="inspector-spacing-label">Right</label>
                                        <span className="inspector-spacing-value">{blockStyles.paddingRight || 0}px</span>
                                    </div>
                                    <Slider.Root
                                        className="inspector-slider-root"
                                        value={[blockStyles.paddingRight || 0]}
                                        onValueChange={(value) => applyStyle({ paddingRight: value[0] })}
                                        max={100}
                                        step={1}
                                    >
                                        <Slider.Track className="inspector-slider-track">
                                            <Slider.Range className="inspector-slider-range" />
                                        </Slider.Track>
                                        <Slider.Thumb className="inspector-slider-thumb" />
                                    </Slider.Root>
                                </div>
                            </div>
                        </div>
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion.Root>
        </aside>
    );
}
