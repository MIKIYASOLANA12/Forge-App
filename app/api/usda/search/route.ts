import { NextRequest, NextResponse } from 'next/server'

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'USDA API key not configured' }, { status: 503 })

  try {
    const res = await fetch(
      `${USDA_API_BASE}/foods/search?query=${encodeURIComponent(query)}&dataType=Foundation,SR%20Legacy,Branded&pageSize=8&api_key=${apiKey}`
    )
    const data = await res.json()

    // Normalize to simplified format
    const foods = (data.foods || []).map((food: any) => {
      const getNutrient = (id: number) =>
        food.foodNutrients?.find((n: any) => n.nutrientId === id)?.value ?? 0

      return {
        fdcId: food.fdcId,
        name: food.description,
        brand: food.brandOwner || null,
        // per 100g values
        calories: Math.round(getNutrient(1008)), // Energy (kcal)
        protein: Math.round(getNutrient(1003) * 10) / 10, // Protein
        carbs: Math.round(getNutrient(1005) * 10) / 10,   // Carbohydrate
        fat: Math.round(getNutrient(1004) * 10) / 10,     // Total fat
        servingSize: food.servingSize || 100,
        servingUnit: food.servingSizeUnit || 'g',
      }
    })

    return NextResponse.json({ foods })
  } catch (error) {
    console.error('USDA API error:', error)
    return NextResponse.json({ error: 'Failed to fetch food data' }, { status: 502 })
  }
}
