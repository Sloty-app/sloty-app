// routes/offers.js
const router = require("express").Router();
const {
  createOffer, getMyOffers, getStoreOffers, getBatchOffers, toggleOffer, deleteOffer,
} = require("../controllers/offerController");
const { protect, authorize } = require("../middleware/auth");

// Specific paths before parameterized ones (:storeId, :id) to avoid
// Express matching "batch" as if it were an id/storeId.
router.get ("/batch",            getBatchOffers); // public
router.get ("/store/:storeId",   getStoreOffers); // public
router.get ("/owner/my-offers",  protect, authorize("owner"), getMyOffers);
router.post("/",                 protect, authorize("owner"), createOffer);
router.put ("/:id/toggle",       protect, authorize("owner"), toggleOffer);
router.delete("/:id",            protect, authorize("owner"), deleteOffer);

module.exports = router;