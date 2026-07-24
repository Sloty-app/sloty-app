import salonImg from "../assets/icons/salon.png";
import bikeImg from "../assets/icons/bike.png";
import carImg from "../assets/icons/car.png";
import doctorImg from "../assets/icons/doctor.png";
import dentistImg from "../assets/icons/dentist.png";
import mobileImg from "../assets/icons/mobile.png";
import labImg from "../assets/icons/lab.png";
import opticianImg from "../assets/icons/optician.png";
import beautyImg from "../assets/icons/beauty.png";
import unisexSalonImg from "../assets/icons/unisex-salon.png";

/**
 * Category artwork — custom 3D character illustrations, one per
 * Sloty category. Swap the imported files above if you ever want
 * to refresh the art style; nothing else needs to change.
 */
const IMAGE_MAP = {
  salon:          salonImg,
  mechanic_bike:  bikeImg,
  mechanic_car:   carImg,
  doctor:         doctorImg,
  dentist:        dentistImg,
  mobile_repair:  mobileImg,
  medical_lab:    labImg,
  optician:       opticianImg,
  beauty_parlour: beautyImg,
  unisex_salon:   unisexSalonImg,
};

export default function CategoryIllustration({ categoryId, size = 32 }) {
  const src = IMAGE_MAP[categoryId];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}