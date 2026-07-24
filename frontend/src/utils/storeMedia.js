import { CATS } from "../constants";

const CATEGORY_COVERS = {
  salon:          "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
  mechanic_bike:  "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80",
  mechanic_car:   "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80",
  doctor:         "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
  dentist:        "https://images.unsplash.com/photo-1606811841687-0750e8d5c8d1?w=800&q=80",
  mobile_repair:  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
  medical_lab:    "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&q=80",
  optician:       "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800&q=80",
  beauty_parlour: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
};

export const getStoreCover = (store) => {
  if (store?.photos?.length) return store.photos[0];
  return CATEGORY_COVERS[store?.category] || CATEGORY_COVERS.salon;
};

export const getCategoryMeta = (categoryId) =>
  CATS.find((c) => c.id === categoryId) || CATS[0];

export const formatRating = (rating) => (rating ? Number(rating).toFixed(1) : "New");

export const getOpenLabel = (store) => {
  if (!store?.isOpen) return `Closed · Opens ${store?.workingHours?.open || "soon"}`;
  return "Open now";
};

/**
 * Deep-links to Google Maps for turn-by-turn directions to a store —
 * opens the native Maps app on mobile, or maps.google.com on desktop.
 * Uses precise lat/lng when the store has it; falls back to a text
 * address search otherwise so the button always works either way.
 */
export const getDirectionsUrl = (store) => {
  if (store?.location?.lat && store?.location?.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${store.location.lat},${store.location.lng}`;
  }
  const addressParts = [store?.address, store?.area, store?.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts || store?.name || "")}`;
};