/**
 * Streak Configuration Model
 *
 * Admin has FULL control over streak milestones and rewards.
 * NO hardcoded defaults - admin must configure everything.
 * Streak rewards will only work after admin sets them up.
 *
 * This is a singleton model - only one document should exist.
 */

const mongoose = require("mongoose");

const streakMilestoneSchema = new mongoose.Schema(
  {
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    reward: {
      type: Number,
      required: true,
      min: 0,
    },
    badge: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const streakConfigSchema = new mongoose.Schema(
  {
    // Singleton identifier
    configId: {
      type: String,
      default: "STREAK_CONFIG",
      unique: true,
    },

    // Is streak system enabled? (Admin controls this)
    enabled: {
      type: Boolean,
      default: false, // Disabled by default until admin enables
    },

    // Milestone configurations (Admin sets these)
    milestones: [streakMilestoneSchema],

    // Last updated by
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedByEmail: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Get streak configuration
 * Returns null if not configured by admin
 */
streakConfigSchema.statics.getConfig = async function () {
  const config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config) {
    // No config exists - admin hasn't set up yet
    return {
      enabled: false,
      milestones: [],
      isConfigured: false,
      message: "Streak system not configured. Admin needs to set it up.",
    };
  }

  return {
    enabled: config.enabled,
    milestones: config.milestones.filter((m) => m.isActive).sort((a, b) => a.days - b.days),
    isConfigured: true,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedByEmail,
  };
};

/**
 * Get active milestones sorted by days
 * Returns empty array if not configured
 */
streakConfigSchema.statics.getActiveMilestones = async function () {
  const config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config || !config.enabled) {
    return [];
  }

  return config.milestones
    .filter((m) => m.isActive)
    .sort((a, b) => a.days - b.days);
};

/**
 * Check if streak system is enabled and configured
 */
streakConfigSchema.statics.isEnabled = async function () {
  const config = await this.findOne({ configId: "STREAK_CONFIG" });
  return config && config.enabled && config.milestones.length > 0;
};

/**
 * Create initial configuration (admin only)
 */
streakConfigSchema.statics.createConfig = async function (data, adminId, adminEmail) {
  // Check if config already exists
  const existing = await this.findOne({ configId: "STREAK_CONFIG" });
  if (existing) {
    throw new Error("Configuration already exists. Use update instead.");
  }

  const config = new this({
    configId: "STREAK_CONFIG",
    enabled: data.enabled || false,
    milestones: data.milestones || [],
    updatedBy: adminId,
    updatedByEmail: adminEmail,
  });

  await config.save();
  return config;
};

/**
 * Update streak configuration (admin only)
 */
streakConfigSchema.statics.updateConfig = async function (data, adminId, adminEmail) {
  let config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config) {
    // Create new config
    config = new this({
      configId: "STREAK_CONFIG",
      enabled: data.enabled || false,
      milestones: data.milestones || [],
      updatedBy: adminId,
      updatedByEmail: adminEmail,
    });
  } else {
    // Update existing
    if (data.enabled !== undefined) {
      config.enabled = data.enabled;
    }
    if (data.milestones !== undefined) {
      config.milestones = data.milestones;
    }
    config.updatedBy = adminId;
    config.updatedByEmail = adminEmail;
  }

  await config.save();
  return config;
};

/**
 * Enable/Disable streak system
 */
streakConfigSchema.statics.setEnabled = async function (enabled, adminId, adminEmail) {
  const config = await this.findOneAndUpdate(
    { configId: "STREAK_CONFIG" },
    {
      $set: {
        enabled: enabled,
        updatedBy: adminId,
        updatedByEmail: adminEmail,
      },
    },
    { new: true, upsert: true }
  );

  return config;
};

/**
 * Add a new milestone
 */
streakConfigSchema.statics.addMilestone = async function (milestone, adminId, adminEmail) {
  let config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config) {
    // Create new config with this milestone
    config = new this({
      configId: "STREAK_CONFIG",
      enabled: false, // Admin must explicitly enable
      milestones: [milestone],
      updatedBy: adminId,
      updatedByEmail: adminEmail,
    });
  } else {
    // Check if days already exists
    const exists = config.milestones.some((m) => m.days === milestone.days);
    if (exists) {
      throw new Error(`Milestone for ${milestone.days} days already exists`);
    }

    config.milestones.push(milestone);
    config.updatedBy = adminId;
    config.updatedByEmail = adminEmail;
  }

  await config.save();
  return config;
};

/**
 * Update a specific milestone
 */
streakConfigSchema.statics.updateMilestone = async function (days, updates, adminId, adminEmail) {
  const config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config) {
    throw new Error("No streak configuration found. Create one first.");
  }

  const milestoneIndex = config.milestones.findIndex((m) => m.days === days);
  if (milestoneIndex === -1) {
    throw new Error(`Milestone for ${days} days not found`);
  }

  // Update milestone fields
  if (updates.days !== undefined) {
    // Check if new days value already exists (if changing days)
    if (updates.days !== days) {
      const exists = config.milestones.some((m) => m.days === updates.days);
      if (exists) {
        throw new Error(`Milestone for ${updates.days} days already exists`);
      }
    }
    config.milestones[milestoneIndex].days = updates.days;
  }
  if (updates.reward !== undefined) {
    config.milestones[milestoneIndex].reward = updates.reward;
  }
  if (updates.badge !== undefined) {
    config.milestones[milestoneIndex].badge = updates.badge;
  }
  if (updates.description !== undefined) {
    config.milestones[milestoneIndex].description = updates.description;
  }
  if (updates.isActive !== undefined) {
    config.milestones[milestoneIndex].isActive = updates.isActive;
  }

  config.updatedBy = adminId;
  config.updatedByEmail = adminEmail;

  await config.save();
  return config;
};

/**
 * Delete a milestone
 */
streakConfigSchema.statics.deleteMilestone = async function (days, adminId, adminEmail) {
  const config = await this.findOne({ configId: "STREAK_CONFIG" });

  if (!config) {
    throw new Error("No streak configuration found");
  }

  const initialLength = config.milestones.length;
  config.milestones = config.milestones.filter((m) => m.days !== days);

  if (config.milestones.length === initialLength) {
    throw new Error(`Milestone for ${days} days not found`);
  }

  config.updatedBy = adminId;
  config.updatedByEmail = adminEmail;

  await config.save();
  return config;
};

/**
 * Delete all configuration (reset)
 */
streakConfigSchema.statics.deleteConfig = async function () {
  await this.deleteOne({ configId: "STREAK_CONFIG" });
  return { message: "Streak configuration deleted" };
};

module.exports = mongoose.model("StreakConfig", streakConfigSchema);
