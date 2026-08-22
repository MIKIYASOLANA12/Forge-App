import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()
  if (!query) return NextResponse.json([])
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'USDA API key is not configured' }, { status: 500 })

  try {
    const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}&pageSize=5`, { next: { revalidate: 3600 } })
    if (!response.ok) return NextResponse.json([])
    const data = await response.json()
    return NextResponse.json((data.foods ?? []).map((food: { fdcId: number; description?: string; foodNutrients?: { nutrientId?: number; nutrientNumber?: string; value?: number }[] }) => {
      const nutrient = (number: string) => food.foodNutrients?.find((item) => item.nutrientNumber === number || item.nutrientId?.toString() === number)?.value ?? 0
      return { fdcId: food.fdcId, name: food.description ?? 'Unknown food', calories: Math.round(nutrient('1008')), protein: Math.round(nutrient('1003') * 10) / 10, carbs: Math.round(nutrient('1005') * 10) / 10, fat: Math.round(nutrient('1004') * 10) / 10, per: '100g' }
    }))
  } catch (error) {
    console.error('USDA search failed:', error)
    return NextResponse.json([])
  }
}