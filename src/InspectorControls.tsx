import React, { useCallback, useEffect, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as Accordion from "@radix-ui/react-accordion";
import * as Slider from "@radix-ui/react-slider";
import {
    $getSelection,
    $isRangeSelection,
    $getNodeByKey,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    ElementNode,
} from "lexical";
import { mergeRegister } from "@lexical/utils";

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

            <Accordion.Root type="multiple" className="inspector-accordion" defaultValue={["colors", "spacing"]}>
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
