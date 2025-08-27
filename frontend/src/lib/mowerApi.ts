import { fetcher } from "./fetcher";
import {
  MowerCreate,
  MowerRead,
  MowerUpdate,
  MowingLogCreate,
  MowingLogRead,
  MaintenanceScheduleCreate,
  MaintenanceScheduleRead,
  MaintenanceLogCreate,
  MaintenanceLogRead,
  MaintenanceDueItem,
} from "../types/mower";

const API_BASE = "/api/v1/mowers";

// Mower CRUD operations
export const mowerApi = {
  // List all mowers
  list: async (): Promise<MowerRead[]> => {
    return fetcher(API_BASE);
  },

  // Get a specific mower
  get: async (id: number): Promise<MowerRead> => {
    return fetcher(`${API_BASE}/${id}`);
  },

  // Create a new mower
  create: async (mower: MowerCreate): Promise<MowerRead> => {
    return fetcher(API_BASE, {
      method: "POST",
      data: mower,
    });
  },

  // Update a mower
  update: async (id: number, mower: MowerUpdate): Promise<MowerRead> => {
    return fetcher(`${API_BASE}/${id}`, {
      method: "PUT",
      data: mower,
    });
  },

  // Delete a mower
  delete: async (id: number): Promise<{ message: string }> => {
    return fetcher(`${API_BASE}/${id}`, {
      method: "DELETE",
    });
  },
};

// Mowing Log operations
export const mowingLogApi = {
  // List mowing logs for a mower
  list: async (mowerId: number): Promise<MowingLogRead[]> => {
    return fetcher(`${API_BASE}/${mowerId}/mowing-logs`);
  },

  // Create a new mowing log
  create: async (
    mowerId: number,
    log: MowingLogCreate
  ): Promise<MowingLogRead> => {
    return fetcher(`${API_BASE}/${mowerId}/mowing-logs`, {
      method: "POST",
      data: log,
    });
  },
};

// Maintenance Schedule operations
export const maintenanceScheduleApi = {
  // List maintenance schedules for a mower
  list: async (mowerId: number): Promise<MaintenanceScheduleRead[]> => {
    return fetcher(`${API_BASE}/${mowerId}/maintenance-schedules`);
  },

  // Create a new maintenance schedule
  create: async (
    mowerId: number,
    schedule: MaintenanceScheduleCreate
  ): Promise<MaintenanceScheduleRead> => {
    return fetcher(`${API_BASE}/${mowerId}/maintenance-schedules`, {
      method: "POST",
      data: schedule,
    });
  },
};

// Maintenance Log operations
export const maintenanceLogApi = {
  // List maintenance logs for a mower
  list: async (mowerId: number): Promise<MaintenanceLogRead[]> => {
    return fetcher(`${API_BASE}/${mowerId}/maintenance-logs`);
  },

  // Create a new maintenance log
  create: async (
    mowerId: number,
    log: MaintenanceLogCreate
  ): Promise<MaintenanceLogRead> => {
    return fetcher(`${API_BASE}/${mowerId}/maintenance-logs`, {
      method: "POST",
      data: log,
    });
  },
};

// Maintenance Due operations
export const maintenanceDueApi = {
  // Get maintenance due for a specific mower
  getForMower: async (mowerId: number): Promise<MaintenanceDueItem[]> => {
    return fetcher(`${API_BASE}/${mowerId}/maintenance-due`);
  },

  // Get all maintenance due across all mowers
  getAll: async (): Promise<MaintenanceDueItem[]> => {
    return fetcher(`${API_BASE}/maintenance-due/all`);
  },
};

// Utility functions
export const mowerUtils = {
  // Get mower type display name
  getMowerTypeDisplayName: (type: string): string => {
    const typeMap: Record<string, string> = {
      rotary: "Rotary",
      reel: "Reel",
      zero_turn: "Zero Turn",
      riding: "Riding",
      push: "Push",
      electric: "Electric",
      robotic: "Robotic",
    };
    return typeMap[type] || type;
  },

  // Get maintenance type display name
  getMaintenanceTypeDisplayName: (type: string): string => {
    const typeMap: Record<string, string> = {
      oil_change: "Oil Change",
      air_filter: "Air Filter",
      spark_plug: "Spark Plug",
      fuel_filter: "Fuel Filter",
      blade_sharpening: "Blade Sharpening",
      backlap: "Backlap",
      reel_grinding: "Reel Grinding",
      bedknife_adjustment: "Bedknife Adjustment",
      belt_replacement: "Belt Replacement",
      gear_oil_change: "Gear Oil Change",
      transmission_service: "Transmission Service",
      battery_replacement: "Battery Replacement",
      electrical_system_check: "Electrical System Check",
      tire_replacement: "Tire Replacement",
      wheel_bearing_service: "Wheel Bearing Service",
      safety_switch_check: "Safety Switch Check",
      throttle_adjustment: "Throttle Adjustment",
      general_service: "General Service",
      winterization: "Winterization",
      spring_startup: "Spring Startup",
    };
    return typeMap[type] || type;
  },

  // Format hours for display
  formatHours: (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    return `${hours} hours`;
  },

  // Format cost for display
  formatCost: (cost?: number): string => {
    if (cost === undefined || cost === null) {
      return "N/A";
    }
    return `$${cost.toFixed(2)}`;
  },

  // Get maintenance status color
  getMaintenanceStatusColor: (
    isOverdue: boolean,
    hoursOverdue: number
  ): string => {
    if (isOverdue) {
      if (hoursOverdue > 10) {
        return "text-red-600"; // Critical
      } else if (hoursOverdue > 5) {
        return "text-orange-600"; // Warning
      } else {
        return "text-yellow-600"; // Caution
      }
    }
    return "text-green-600"; // Good
  },

  // Get maintenance status badge variant
  getMaintenanceStatusBadge: (
    isOverdue: boolean,
    hoursOverdue: number
  ): string => {
    if (isOverdue) {
      if (hoursOverdue > 10) {
        return "destructive"; // Critical
      } else if (hoursOverdue > 5) {
        return "secondary"; // Warning
      } else {
        return "outline"; // Caution
      }
    }
    return "default"; // Good
  },
};
