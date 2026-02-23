"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";

const inputClasses =
  "block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400";

type Person = { id: string; name: string };

function filterPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((p) => (p.name ?? "").toLowerCase().includes(q));
}

export function PersonCombobox({
  value,
  onChange,
  options,
  placeholder = "Type to search...",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Person[];
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedPerson = useMemo(() => options.find((p) => p.id === value), [options, value]);

  useEffect(() => {
    if (selectedPerson) setInputValue(selectedPerson.name);
    else setInputValue("");
  }, [value, selectedPerson?.id]);

  const filtered = useMemo(() => filterPeople(options, inputValue), [options, inputValue]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [inputValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (inputValue.trim() === "") {
          onChange("");
        } else if (selectedPerson) {
          setInputValue(selectedPerson.name);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedPerson, inputValue, onChange]);

  function select(person: Person) {
    onChange(person.id);
    setInputValue(person.name);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue(selectedPerson?.name ?? "");
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      const person = filtered[highlightIndex];
      if (person) {
        select(person);
        e.preventDefault();
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listId}
        className={inputClasses}
        autoComplete="off"
      />
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg py-1 text-body-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-surface-500 dark:text-surface-400">No matches</li>
          ) : (
            filtered.map((person, i) => (
              <li
                key={person.id}
                role="option"
                aria-selected={value === person.id}
                className={`px-3 py-2 cursor-pointer ${
                  i === highlightIndex
                    ? "bg-jblue-50 dark:bg-jblue-900/30 text-jblue-800 dark:text-jblue-200"
                    : "text-surface-800 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-dark-raised"
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(person);
                }}
              >
                {person.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function PersonMultiCombobox({
  value,
  onChange,
  options,
  placeholder = "Type to add...",
  "aria-label": ariaLabel,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  options: Person[];
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPeople = useMemo(
    () => value.map((id) => options.find((p) => p.id === id)).filter(Boolean) as Person[],
    [value, options]
  );
  const available = useMemo(
    () => options.filter((p) => !value.includes(p.id)),
    [options, value]
  );
  const filtered = useMemo(() => filterPeople(available, inputValue), [available, inputValue]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [inputValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function add(person: Person) {
    onChange([...value, person.id]);
    setInputValue("");
    setIsOpen(true);
    setHighlightIndex(0);
  }

  function remove(id: string) {
    onChange(value.filter((i) => i !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      const person = filtered[highlightIndex];
      if (person) {
        add(person);
        e.preventDefault();
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`min-h-9 flex flex-wrap gap-1.5 items-center px-3 py-1.5 rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised focus-within:ring-2 focus-within:ring-jblue-500/30 focus-within:border-jblue-400`}>
        {selectedPeople.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-surface-100 dark:bg-dark-muted text-body-sm text-surface-800 dark:text-surface-100"
          >
            {p.name}
            <button
              type="button"
              onClick={() => remove(p.id)}
              className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-dark-border text-surface-500 hover:text-surface-800 dark:hover:text-surface-200"
              aria-label={`Remove ${p.name}`}
            >
              <span aria-hidden>×</span>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedPeople.length === 0 ? placeholder : ""}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-0 text-body-sm text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-0"
          autoComplete="off"
        />
      </div>
      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg py-1 text-body-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-surface-500 dark:text-surface-400">No matches</li>
          ) : (
            filtered.map((person, i) => (
              <li
                key={person.id}
                role="option"
                className={`px-3 py-2 cursor-pointer ${
                  i === highlightIndex
                    ? "bg-jblue-50 dark:bg-jblue-900/30 text-jblue-800 dark:text-jblue-200"
                    : "text-surface-800 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-dark-raised"
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(person);
                }}
              >
                {person.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
