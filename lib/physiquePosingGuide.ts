export interface PoseGuide {
  id: string;
  poseNumber: number;
  title: string;
  subtitle: string;
  targetMuscles: string[];
  cameraStand: {
    height: string;
    distance: string;
    lighting: string;
  };
  postureSteps: string[];
  masterCue: string;
}

export const POSE_GUIDES: PoseGuide[] = [
  {
    id: "front_relaxed",
    poseNumber: 1,
    title: "Front Relaxed & V-Taper",
    subtitle: "Upper/Lower Chest, Neck, Abs & Core Alignment",
    targetMuscles: ["Pectoralis Major (Chest)", "Sternocleidomastoid (Neck)", "Rectus Abdominis (Abs)", "Serratus Anterior", "Clavicle Width"],
    cameraStand: {
      height: "Chest level (approx. 1.2m from ground)",
      distance: "2.5 – 3.0 meters directly in front",
      lighting: "Soft frontal or 45-degree overhead light to cast shadows under chest and abs",
    },
    postureSteps: [
      "Stand straight with feet shoulder-width apart, toes pointed slightly outward.",
      "Keep your chin parallel to the floor to highlight neck thickness and posture.",
      "Flare your lats slightly without hunching your shoulders.",
      "Pull your belly button inward and flex your abdominal wall lightly without holding your breath completely.",
      "Keep hands relaxed at your sides with palms facing your thighs.",
    ],
    masterCue: "Think: 'Chest high, lats flared, core locked, neck proud'.",
  },
  {
    id: "front_biceps",
    poseNumber: 2,
    title: "Front Double Biceps",
    subtitle: "Biceps Peak, Forearms, Front Delts & Upper Abs",
    targetMuscles: ["Biceps Brachii (Long & Short Heads)", "Brachioradialis (Forearms)", "Anterior/Lateral Deltoids", "Intercostals"],
    cameraStand: {
      height: "Shoulder / Eye level",
      distance: "2.5 meters directly in front",
      lighting: "Even frontal lighting to illuminate arm separation and delt caps",
    },
    postureSteps: [
      "Raise both upper arms parallel to the floor or slightly higher than shoulder level.",
      "Bend elbows to a 90-degree angle and curl your wrists slightly inward toward your ears to peak the biceps.",
      "Inhale to expand the ribcage while crunching down lightly on the abdominal wall.",
      "Flex both forearms and biceps with maximum intent.",
    ],
    masterCue: "Think: 'Elbows high, wrists curled inward, peak the biceps, crunch the abs'.",
  },
  {
    id: "back_wings",
    poseNumber: 3,
    title: "Back Lat Spread (The Wings)",
    subtitle: "Lats Width, V-Taper, Upper Back & Traps",
    targetMuscles: ["Latissimus Dorsi ('Wings')", "Teres Major", "Rhomboids", "Trapezius", "Posterior Delts"],
    cameraStand: {
      height: "Mid-back / Shoulder-blade level from behind",
      distance: "2.5 – 3.0 meters from behind",
      lighting: "Overhead light to accentuate lat width flare and shoulder-to-waist taper",
    },
    postureSteps: [
      "Turn completely around with your back to the camera.",
      "Place your thumbs or closed fists firmly on your waistline just above your hip bones.",
      "Roll your shoulders slightly forward, then push your elbows forward.",
      "Flare your shoulder blades outward as wide as possible to spread your 'wings'.",
      "Lean back 2-3 degrees to show full lat insertion down to the waist.",
    ],
    masterCue: "Think: 'Thumbs on waist, push elbows forward, open the wings as wide as a glider'.",
  },
  {
    id: "back_biceps",
    poseNumber: 4,
    title: "Back Double Biceps",
    subtitle: "Triceps Long Head, Rear Delts, Traps & Spine Density",
    targetMuscles: ["Triceps Brachii (Long Head)", "Rear Deltoids", "Middle & Lower Trapezius", "Infraspinatus", "Erector Spinae"],
    cameraStand: {
      height: "Upper back level from behind",
      distance: "2.5 meters from behind",
      lighting: "Top-down lighting to reveal back ridges, traps separation, and triceps",
    },
    postureSteps: [
      "Stand facing away from the camera.",
      "Raise both arms into a double biceps pose with elbows at or slightly above shoulder level.",
      "Firmly pull your shoulder blades together to squeeze the middle traps and rhomboids.",
      "Flex your biceps and the long head of your triceps simultaneously.",
      "Step one foot back slightly on your toes to engage your lower back.",
    ],
    masterCue: "Think: 'Squeeze the shoulder blades together, flex triceps long head and biceps'.",
  },
  {
    id: "side_triceps",
    poseNumber: 5,
    title: "Side Chest & Triceps Extension",
    subtitle: "Triceps Horseshoe, Chest Depth & Neck Profile",
    targetMuscles: ["Triceps (Lateral & Medial Heads)", "Pectoral Girth / Chest Shelf", "Deltoid Cap", "Neck Profile"],
    cameraStand: {
      height: "Mid-chest level from a 90-degree side profile",
      distance: "2.5 meters from the side",
      lighting: "Side-angled lighting to highlight triceps horseshoe separation",
    },
    postureSteps: [
      "Turn 90 degrees to face perpendicular to the camera.",
      "Reach behind your back with your rear arm and grab the wrist or fingers of the arm facing the camera.",
      "Fully extend and lock the elbow of the front arm, pressing your triceps against your ribcage.",
      "Flex your triceps with full force to flare the lateral horseshoe shape.",
      "Inhale deeply to expand your ribcage and show maximum chest thickness.",
    ],
    masterCue: "Think: 'Lock the elbow, press arm against ribs, pop the horseshoe triceps, puff chest'.",
  },
];
