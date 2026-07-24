import { Scissors, Bike, Car, Stethoscope, Smile, Smartphone, Microscope, Eye, Sparkles, HeartPulse, Wrench, Brush, Users } from "lucide-react";
export const CATS = [
  { id:"salon",          Icon:Scissors,    name:"Salon & Barber",  color:"#8B5CF6", bg:"#F3EFFF" },
  { id:"mechanic_bike",  Icon:Bike,        name:"Bike Mechanic",   color:"#00C9B1", bg:"#F0FDFB" },
  { id:"mechanic_car",   Icon:Car,         name:"Car Service",     color:"#3B9EFF", bg:"#F0F7FF" },
  { id:"doctor",         Icon:Stethoscope, name:"Doctor / Clinic", color:"#7ED957", bg:"#F4FFF0" },
  { id:"dentist",        Icon:Smile,       name:"Dentist",         color:"#FFD23F", bg:"#FFFBF0" },
  { id:"mobile_repair",  Icon:Smartphone,  name:"Mobile Repair",   color:"#B06AFF", bg:"#F8F0FF" },
  { id:"medical_lab",    Icon:Microscope,  name:"Medical Lab",     color:"#54A0FF", bg:"#F0F5FF" },
  { id:"optician",       Icon:Eye,         name:"Eye / Optician",  color:"#A29BFE", bg:"#F5F4FF" },
  { id:"beauty_parlour", Icon:Sparkles,    name:"Beauty Parlour",  color:"#FF6B9A", bg:"#FFF0F5" },
  { id:"unisex_salon",   Icon:Users,       name:"Unisex Salon",    color:"#FF9166", bg:"#FFF3EE" },
];
export const getCat = (id) => CATS.find(c => c.id === id) || CATS[0];
/**
 * Home-screen groupings — bundles related categories under one umbrella
 * heading (e.g. all 4 health-related categories under "Health"), shown
 * on the Home screen as a section heading with the individual category
 * icons listed underneath it. Tapping a category opens the Stores
 * screen pre-filtered to it, with sub-filter chips to widen back out
 * to the rest of the group from there.
 */
export const GROUPS = [
  {
    id: "health",
    name: "Health & Medical",
    Icon: HeartPulse,
    color: "#54A0FF",
    bg: "#F0F5FF",
    categoryIds: ["doctor", "dentist", "optician", "medical_lab"],
  },
  {
    id: "beauty",
    name: "Beauty & Grooming",
    Icon: Brush,
    color: "#FF6B9A",
    bg: "#FFF0F5",
    categoryIds: ["salon", "beauty_parlour", "unisex_salon"],
  },
  {
    id: "mechanic",
    name: "Mechanic & Repair",
    Icon: Wrench,
    color: "#00C9B1",
    bg: "#F0FDFB",
    categoryIds: ["mechanic_bike", "mechanic_car", "mobile_repair"],
  },
];
export const getGroup = (id) => GROUPS.find(g => g.id === id) || null;
/** Which group (if any) a given category belongs to — used to show
 *  "Health & Medical" as a breadcrumb-style label on filtered screens. */
export const getGroupForCategory = (categoryId) =>
  GROUPS.find(g => g.categoryIds.includes(categoryId)) || null;
export const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Brand palette — official Sloty look is a violet → vibrant magenta
// two-tone gradient: C.pri (violet) fading into C.priDark / C.priLight
// (bright pink/magenta), used throughout buttons, headers, and
// highlights. These 3 values are the single source of truth for the
// gradient used across every screen.
export const C = {
  pri:"#8B5CF6", priDark:"#DB2777", priLight:"#EC4899", sec:"#1A1A2E",
  green:"#00C9A7", red:"#FF6B6B", blue:"#3B9EFF", acc:"#FFD23F",
  bg:"#F0F2F8", card:"#FFFFFF", text:"#1A1A2E", muted:"#8892A4",
  inputBg:"#FAFBFF",
};