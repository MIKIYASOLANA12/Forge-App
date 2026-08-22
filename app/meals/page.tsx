"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock3, LoaderCircle, Plus, Search, Trash2, Utensils, X } from "lucide-react";

type Targets = { calorieTarget: number; proteinTarget: number; carbTarget: number; fatTarget: number };
type Item = { name: string; quantity: string; calories: number; protein: number; carbs: number; fat: number; base: { calories: number; protein: number; carbs: number; fat: number } };
type Meal = { id: string; label: string; eatenAt: string; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number; items: ({ id: string } & Omit<Item, "base">)[] };
type SearchResult = { fdcId: number; name: string; calories: number; protein: number; carbs: number; fat: number; per: string };

const initialTargets: Targets = { calorieTarget: 2500, proteinTarget: 150, carbTarget: 300, fatTarget: 80 };
const nutrients = [
  ["Calories", "calorieTarget", "calories", "kcal"],
  ["Protein", "proteinTarget", "protein", "g"],
  ["Carbs", "carbTarget", "carbs", "g"],
  ["Fat", "fatTarget", "fat", "g"],
] as const;

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [targets, setTargets] = useState(initialTargets);
  const [editingTargets, setEditingTargets] = useState(false);
  const [label, setLabel] = useState("Breakfast");
  const [eatenAt, setEatenAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const [mealsResponse, targetsResponse] = await Promise.all([fetch(`/api/meals?date=${new Date().toISOString().slice(0, 10)}`), fetch("/api/nutrition/targets")]);
    if (mealsResponse.ok) setMeals(await mealsResponse.json());
    if (targetsResponse.ok) setTargets(await targetsResponse.json());
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setLoadingSearch(true);
      const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(query)}`);
      if (response.ok) setResults(await response.json());
      setLoadingSearch(false);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const totals = meals.reduce((total, meal) => ({ calories: total.calories + meal.totalCalories, protein: total.protein + meal.totalProtein, carbs: total.carbs + meal.totalCarbs, fat: total.fat + meal.totalFat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const draftTotals = items.reduce((total, item) => ({ calories: total.calories + item.calories, protein: total.protein + item.protein, carbs: total.carbs + item.carbs, fat: total.fat + item.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const addResult = (result: SearchResult) => {
    setItems((current) => [...current, { name: result.name, quantity: "100g", calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat, base: result }]);
    setQuery(""); setResults([]);
  };
  const updateQuantity = (index: number, quantity: string) => {
    const grams = Math.max(0, Number.parseFloat(quantity) || 0);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity, calories: Math.round(item.base.calories * grams / 100), protein: Math.round(item.base.protein * grams / 100 * 10) / 10, carbs: Math.round(item.base.carbs * grams / 100 * 10) / 10, fat: Math.round(item.base.fat * grams / 100 * 10) / 10 } : item));
  };
  const saveMeal = async () => {
    setError(""); if (!label.trim() || !items.length) { setError("Add at least one food item before logging the meal."); return; }
    setSaving(true);
    const response = await fetch("/api/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, eatenAt, items: items.map(({ base, ...item }) => item) }) });
    setSaving(false);
    if (!response.ok) { setError("Could not save this meal."); return; }
    setItems([]); setQuery(""); await load();
  };
  const saveTargets = async () => {
    const response = await fetch("/api/nutrition/targets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(targets) });
    if (response.ok) { setTargets(await response.json()); setEditingTargets(false); }
  };
  const deleteMeal = async (meal: Meal) => {
    if (!window.confirm(`Delete ${meal.label}? This cannot be undone.`)) return;
    const response = await fetch(`/api/meals/${meal.id}`, { method: "DELETE" });
    if (response.ok) setMeals((current) => current.filter((item) => item.id !== meal.id));
  };

  return <div className="mx-auto w-full max-w-[1400px] animate-fade-in pb-10">
    <section className="mb-6 flex flex-col justify-between gap-5 border-b border-[var(--border)] pb-6 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--xp-gold)]">Fuel / daily intake</p><h1>Eat with intention.</h1><p className="mt-2 max-w-xl text-sm">Log what you eat, see the numbers clearly, and keep the day pointed at your targets.</p></div><div className="flex items-center gap-3 rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)] px-4 py-3"><Utensils size={18} className="text-[var(--xp-gold)]" /><div><div className="text-sm font-bold">{meals.length} meal{meals.length === 1 ? "" : "s"} today</div><div className="text-xs text-[var(--text-muted)]">{Math.round(totals.calories).toLocaleString()} kcal logged</div></div></div></section>

    <section className="card mb-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg">Daily nutrition</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Today&apos;s logged totals versus your targets</p></div><button className="btn btn-ghost btn-sm" onClick={() => editingTargets ? void saveTargets() : setEditingTargets(true)}>{editingTargets ? "Save targets" : "Edit targets"}</button></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{nutrients.map(([name, targetKey, valueKey, unit]) => { const value = totals[valueKey]; const target = targets[targetKey]; const percent = Math.min(value / target * 100, 100); return <div key={name}><div className="mb-2 flex items-end justify-between text-xs"><span className="font-semibold">{name}</span>{editingTargets ? <input className="input h-7 w-20 p-1 text-right text-xs" type="number" min="1" value={target} onChange={(event) => setTargets({ ...targets, [targetKey]: Number(event.target.value) })} /> : <span className="text-[var(--text-muted)]">{Math.round(value * 10) / 10} / {target}{unit}</span>}</div><div className="progress-bar"><div className={`progress-fill ${value > target ? "bg-[var(--danger)]" : name === "Calories" ? "bg-[var(--xp-gold)]" : "bg-[var(--coding)]"}`} style={{ width: `${percent}%` }} /></div></div>; })}</div></section>
    {(targets.proteinTarget - totals.protein > 40 || targets.calorieTarget - totals.calories > 500) && <section className="mb-5 border-l-2 border-[var(--xp-gold)] bg-[rgba(245,158,11,0.06)] px-4 py-3 text-sm">{targets.proteinTarget - totals.protein > 40 && <p>You&apos;re {Math.round(targets.proteinTarget - totals.protein)}g short on protein. High-protein options: eggs, chicken, lentils, fish.</p>}{targets.calorieTarget - totals.calories > 500 && <p className="mt-1">You&apos;re {Math.round(targets.calorieTarget - totals.calories)} calories short. Consider adding a balanced meal.</p>}</section>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]"><section className="card"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg">Log a meal</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Add foods from real USDA nutrition data</p></div><span className="badge bg-[rgba(59,130,246,0.12)] text-[var(--study)]">{items.length} items</span></div><div className="grid gap-3 sm:grid-cols-[1fr_190px]"><input className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Meal label" /><input className="input" type="datetime-local" value={eatenAt} onChange={(event) => setEatenAt(event.target.value)} /></div><div className="relative mt-4"><Search size={16} className="absolute left-3 top-3 text-[var(--text-muted)]" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods, e.g. eggs or chicken breast" />{(loadingSearch || results.length > 0) && <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border-active)] bg-[var(--bg-elevated)] shadow-xl">{loadingSearch && <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]"><LoaderCircle size={14} className="animate-spin" /> Searching USDA...</div>}{results.map((result) => <button key={result.fdcId} className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-3 text-left text-sm last:border-0 hover:bg-[var(--bg-overlay)]" onClick={() => addResult(result)}><span className="pr-3">{result.name}</span><span className="shrink-0 text-xs text-[var(--text-muted)]">{result.calories} kcal / 100g</span></button>)}</div>}</div><div className="mt-4 space-y-2">{items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.name}</div><div className="mt-1 text-xs text-[var(--text-muted)]">{item.calories} kcal · {item.protein}g protein</div></div><input className="input w-24 px-2 py-2 text-xs" value={item.quantity} onChange={(event) => updateQuantity(index, event.target.value)} aria-label={`Quantity for ${item.name}`} /><button className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.name}`}><X size={15} /></button></div>)}</div>{error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}<div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4"><span className="text-xs text-[var(--text-muted)]">Draft: {Math.round(draftTotals.calories)} kcal · {Math.round(draftTotals.protein * 10) / 10}g protein</span><button className="btn btn-primary" onClick={() => void saveMeal()} disabled={saving || !items.length}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Log meal</button></div></section>

      <section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg">Today&apos;s meals</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{meals.length ? "Expand a meal to inspect its items" : "No meals logged today yet"}</p></div></div><div className="space-y-3">{meals.map((meal) => { const open = openMeal === meal.id; return <div className="card" key={meal.id}><div className="flex items-start gap-3"><button className="min-w-0 flex-1 text-left" onClick={() => setOpenMeal(open ? null : meal.id)}><div className="flex items-center gap-2"><span className="font-semibold">{meal.label}</span>{open ? <ChevronUp size={15} className="text-[var(--text-muted)]" /> : <ChevronDown size={15} className="text-[var(--text-muted)]" />}</div><div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]"><Clock3 size={13} />{new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}<span>·</span>{meal.items.length} item{meal.items.length === 1 ? "" : "s"}</div></button><div className="text-right"><div className="font-bold text-[var(--xp-gold)]">{meal.totalCalories} kcal</div><div className="mt-1 text-xs text-[var(--text-muted)]">{meal.totalProtein}g protein</div></div><button className="p-2 text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => void deleteMeal(meal)} aria-label={`Delete ${meal.label}`}><Trash2 size={15} /></button></div>{open && <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">{meal.items.map((item) => <div className="flex justify-between gap-3 text-xs" key={item.id}><span className="text-[var(--text-secondary)]">{item.name} <span className="text-[var(--text-muted)]">({item.quantity})</span></span><span className="shrink-0 text-[var(--text-muted)]">{item.calories} kcal · P {item.protein} · C {item.carbs} · F {item.fat}</span></div>)}</div>}</div>; })}</div></section></div>
  </div>;
}
