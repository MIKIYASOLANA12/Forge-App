import { jsPDF } from 'jspdf';

interface MonthlyReportData {
  year: number;
  month: number;
  totalXp: number;
  endingLevel: number;
  xpEarned: number;
  workoutRate: number;
  studyRate: number;
  codingRate: number;
  readingRate: number;
  nutritionScore: number;
  habitRate: number;
  perfectDays: number;
  missedDays: number;
  longestStreak: number;
  bestDay: string;
  weakestDay: string;
  strongestArea: string;
  weakestArea: string;
  biggestImprovement: string;
  biggestDecline: string;
  recommendations: string[];
  monthDays?: any[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Generates an official Forge Monthly Progress Report PDF buffer server-side.
 */
export function generateMonthlyReportPdf(data: MonthlyReportData): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const monthName = MONTH_NAMES[data.month - 1] || `Month ${data.month}`;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Color palette
  const darkBg = [15, 23, 42]; // #0f172a
  const cardBg = [30, 41, 59]; // #1e293b
  const accentOrange = [249, 115, 22]; // #f97316
  const accentBlue = [59, 130, 246]; // #3b82f6
  const textWhite = [248, 250, 252];
  const textMuted = [148, 163, 184];
  const successGreen = [34, 197, 94];

  // Header Banner
  doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Forge Logo & Title
  doc.setTextColor(accentOrange[0], accentOrange[1], accentOrange[2]);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('FORGE', 14, 18);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(14);
  doc.text('Monthly Progress Report', 14, 28);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Period: ${monthName} ${data.year}  |  Timezone: Africa/Addis_Ababa (05:00)`, 14, 35);

  // Level & XP Badge
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(pageWidth - 65, 10, 52, 24, 3, 3, 'F');
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS', pageWidth - 60, 18);
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(12);
  doc.text(`Level ${data.endingLevel}  (${data.totalXp.toLocaleString()} XP)`, pageWidth - 60, 27);

  let y = 50;

  // Executive Summary Card
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
  doc.roundedRect(14, y, pageWidth - 28, 38, 3, 3, 'F');

  doc.setTextColor(accentOrange[0], accentOrange[1], accentOrange[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE OVERVIEW', 20, y + 9);

  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');

  const summaryP1 = `During ${monthName} ${data.year}, you accumulated +${data.xpEarned.toLocaleString()} XP. Overall consistency reached strong operational momentum with ${data.perfectDays} perfect execution days and a peak streak of ${data.longestStreak} consecutive days.`;
  const summaryLines = doc.splitTextToSize(summaryP1, pageWidth - 42);
  doc.text(summaryLines, 20, y + 17);

  y += 46;

  // Key Metrics Grid
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Performance Indicators', 14, y);
  y += 6;

  const kpis = [
    { label: 'Longest Streak', val: `${data.longestStreak} Days`, color: accentOrange },
    { label: 'Perfect Days', val: `${data.perfectDays} Days`, color: successGreen },
    { label: 'Monthly XP Earned', val: `+${data.xpEarned.toLocaleString()} XP`, color: accentBlue },
    { label: 'Missed Days', val: `${data.missedDays} Days`, color: [239, 68, 68] },
  ];

  const cardW = (pageWidth - 28 - 9) / 4;
  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardW + 3);
    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'F');

    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.label.toUpperCase(), x + 4, y + 7);

    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.setFontSize(11);
    doc.text(kpi.val, x + 4, y + 15);
  });

  y += 28;

  // Domain Consistency Breakdown Table
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Domain Consistency Breakdown', 14, y);
  y += 6;

  const domains = [
    { name: 'Workout Adherence', rate: data.workoutRate },
    { name: 'Study Focus', rate: data.studyRate },
    { name: 'Coding Sessions', rate: data.codingRate },
    { name: 'Reading & Scripture', rate: data.readingRate },
    { name: 'Habit Consistency', rate: data.habitRate },
    { name: 'Nutrition Targets', rate: data.nutritionScore },
  ];

  domains.forEach((item, idx) => {
    const rowY = y + idx * 9;
    doc.setFillColor(idx % 2 === 0 ? cardBg[0] : 20, idx % 2 === 0 ? cardBg[1] : 30, idx % 2 === 0 ? cardBg[2] : 45);
    doc.rect(14, rowY, pageWidth - 28, 8, 'F');

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item.name, 18, rowY + 5.5);

    // Progress bar visualization
    const barX = 95;
    const barW = 65;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(barX, rowY + 2, barW, 4, 1, 1, 'F');

    const fillW = Math.max(1, Math.round((barW * item.rate) / 100));
    doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    doc.roundedRect(barX, rowY + 2, fillW, 4, 1, 1, 'F');

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.rate}%`, pageWidth - 22, rowY + 5.5, { align: 'right' });
  });

  y += domains.length * 9 + 8;

  // Highlights & Insights
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Performance Insights & Analytics', 14, y);
  y += 6;

  const insights = [
    { label: 'Best Performing Day', text: data.bestDay },
    { label: 'Weakest Recorded Day', text: data.weakestDay },
    { label: 'Strongest Area', text: data.strongestArea },
    { label: 'Biggest Improvement', text: data.biggestImprovement },
    { label: 'Area Needing Attention', text: data.biggestDecline },
  ];

  insights.forEach((ins) => {
    doc.setTextColor(accentOrange[0], accentOrange[1], accentOrange[2]);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${ins.label}:`, 16, y);

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(ins.text || 'N/A', 62, y);
    y += 6;
  });

  y += 4;

  // Next Month Strategic Recommendations
  doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Strategic Focus for Next Month', 14, y);
  y += 6;

  data.recommendations.forEach((rec, idx) => {
    doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}.`, 16, y);

    doc.setTextColor(textWhite[0], textWhite[1], textWhite[2]);
    doc.setFont('helvetica', 'normal');
    const recLines = doc.splitTextToSize(rec, pageWidth - 36);
    doc.text(recLines, 22, y);
    y += recLines.length * 5 + 1;
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setLineWidth(0.2);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Forge Personal Growth OS  •  Official Certified Progress Record  •  Database Verified', 14, footerY);
  doc.text(`Generated: ${new Date().toISOString()}`, pageWidth - 14, footerY, { align: 'right' });

  return new Uint8Array(doc.output('arraybuffer'));
}
