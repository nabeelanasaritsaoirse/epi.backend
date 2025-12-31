const Faq = require("../models/Faq");

// ================================
// ADMIN – CREATE APP FAQ
// ================================
exports.createAppFaq = async (req, res) => {
  try {
    const { question, answer, isActive } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ success: false, message: "Question and answer required" });
    }

    const faq = await Faq.create({
      type: "APP",
      question,
      answer,
      isActive,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================
// ADMIN – CREATE PRODUCT FAQ
// ================================
exports.createProductFaq = async (req, res) => {
  try {
    const { productId } = req.params;
    const { question, answer, isActive } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ success: false, message: "Question and answer required" });
    }

    const faq = await Faq.create({
      type: "PRODUCT",
      productId,
      question,
      answer,
      isActive,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================
// ADMIN – UPDATE FAQ
// ================================
exports.updateFaq = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await Faq.findByIdAndUpdate(faqId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    res.json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================
// ADMIN – DELETE FAQ
// ================================
exports.deleteFaq = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await Faq.findByIdAndDelete(faqId);

    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    res.json({ success: true, message: "FAQ deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================
// USER – GET APP FAQS
// ================================
exports.getAppFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find({
      type: "APP",
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================================
// USER – GET PRODUCT FAQS
// ================================
exports.getProductFaqs = async (req, res) => {
  try {
    const { productId } = req.params;

    const faqs = await Faq.find({
      type: "PRODUCT",
      productId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
