import React, { useState, useRef, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { blockCommands } from "./blockCommands";
import { $getRoot, $createParagraphNode } from "lexical";
import { $isRowNode } from "./nodes/RowNode";

export function InsertBlockButton() {
    const [editor] = useLexicalComposerContext();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleButtonClick = () => {
        setIsOpen(!isOpen);
        setSelectedIndex(0);
    };

    const handleCommandSelect = (index: number) => {
        const command = blockCommands[index];
        if (command) {
            // First, ensure we have a selection at the end of the document
            editor.update(() => {
                const root = $getRoot();
                const lastChild = root.getLastChild();

                if (lastChild) {
                    // If last child is a container like RowNode, insert a new paragraph after it
                    // This prevents insertion into the container's children
                    if ($isRowNode(lastChild)) {
                        const paragraph = $createParagraphNode();
                        lastChild.insertAfter(paragraph);
                        paragraph.select();
                    } else {
                        // For regular nodes, select the end
                        lastChild.selectEnd();
                    }
                } else {
                    // If empty, create a paragraph and select it
                    const paragraph = $createParagraphNode();
                    root.append(paragraph);
                    paragraph.select();
                }
            });

            // Then execute the command
            command.onSelect(editor);
            setIsOpen(false);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < blockCommands.length - 1 ? prev + 1 : 0
                    );
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                        prev > 0 ? prev - 1 : blockCommands.length - 1
                    );
                    break;
                case "Enter":
                    event.preventDefault();
                    handleCommandSelect(selectedIndex);
                    break;
                case "Escape":
                    event.preventDefault();
                    setIsOpen(false);
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            return () => {
                document.removeEventListener("keydown", handleKeyDown);
            };
        }
    }, [isOpen, selectedIndex]);

    return (
        <div className="insert-block-button-container">
            <button
                ref={buttonRef}
                className="insert-block-button"
                onClick={handleButtonClick}
                aria-label="Insert block"
            >
                <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
                    <path
                        d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                    />
                </svg>
                <span>Insert Block</span>
            </button>

            {isOpen && (
                <div ref={menuRef} className="insert-block-menu">
                    <div className="insert-block-menu__header">Choose a block</div>
                    <div className="insert-block-menu__list">
                        {blockCommands.map((command, index) => (
                            <button
                                key={command.id}
                                className={`insert-block-menu__item ${
                                    index === selectedIndex ? "insert-block-menu__item--selected" : ""
                                }`}
                                onClick={() => handleCommandSelect(index)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="insert-block-menu__icon">{command.icon}</span>
                                <span className="insert-block-menu__label">{command.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
