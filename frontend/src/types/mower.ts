// Mower Types
export enum MowerType {
  ROTARY = "rotary",
  REEL = "reel",
  ZERO_TURN = "zero_turn",
  RIDING = "riding",
  PUSH = "push",
  ELECTRIC = "electric",
  ROBOTIC = "robotic",
}

export enum MaintenanceType {
  // Engine Maintenance
  OIL_CHANGE = "oil_change",
  AIR_FILTER = "air_filter",
  SPARK_PLUG = "spark_plug",
  FUEL_FILTER = "fuel_filter",

  // Cutting System
  BLADE_SHARPENING = "blade_sharpening",
  BACKLAP = "backlap",
  REEL_GRINDING = "reel_grinding",
  BEDKNIFE_ADJUSTMENT = "bedknife_adjustment",

  // Drive System
  BELT_REPLACEMENT = "belt_replacement",
  GEAR_OIL_CHANGE = "gear_oil_change",
  TRANSMISSION_SERVICE = "transmission_service",

  // Electrical
  BATTERY_REPLACEMENT = "battery_replacement",
  ELECTRICAL_SYSTEM_CHECK = "electrical_system_check",

  // Tires/Wheels
  TIRE_REPLACEMENT = "tire_replacement",
  WHEEL_BEARING_SERVICE = "wheel_bearing_service",

  // Safety & Controls
  SAFETY_SWITCH_CHECK = "safety_switch_check",
  THROTTLE_ADJUSTMENT = "throttle_adjustment",

  // General
  GENERAL_SERVICE = "general_service",
  WINTERIZATION = "winterization",
  SPRING_STARTUP = "spring_startup",
}

// Base Types
export interface MowerBase {
  name: string;
  brand?: string;
  model?: string;
  year?: number;
  mower_type: MowerType;
  engine_hours: number;
  default_mowing_time_minutes?: number;
  notes?: string;
  location_id: number;
  is_active: boolean;
}

export interface MowingLogBase {
  mowing_date: string; // ISO date string
  duration_minutes: number;
  notes?: string;
  lawn_id: number;
}

export interface MaintenancePartBase {
  part_name: string;
  part_number?: string;
  supplier?: string;
  part_url?: string;
  estimated_cost?: number;
  notes?: string;
}

export interface MaintenanceScheduleBase {
  maintenance_type: MaintenanceType;
  custom_name?: string;
  interval_hours: number;
  interval_months?: number;
  notes?: string;
  parts: MaintenancePartBase[];
}

export interface MaintenanceLogPartBase {
  part_name: string;
  part_number?: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  supplier?: string;
  notes?: string;
}

export interface MaintenanceLogBase {
  maintenance_type: MaintenanceType;
  custom_name?: string;
  maintenance_date: string; // ISO date string
  hours_at_maintenance: number;
  total_cost?: number;
  labor_cost?: number;
  performed_by?: string;
  notes?: string;
  parts_used: MaintenanceLogPartBase[];
}

// Create Types
export interface MowerCreate extends MowerBase {}

export interface MowingLogCreate extends MowingLogBase {
  mower_id: number;
}

export interface MaintenanceScheduleCreate extends MaintenanceScheduleBase {
  mower_id: number;
}

export interface MaintenanceLogCreate extends MaintenanceLogBase {
  mower_id: number;
  maintenance_schedule_id?: number;
}

// Read Types
export interface MaintenancePartRead extends MaintenancePartBase {
  id: number;
  maintenance_schedule_id: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceLogPartRead extends MaintenanceLogPartBase {
  id: number;
  maintenance_log_id: number;
  created_at: string;
}

export interface MaintenanceScheduleRead extends MaintenanceScheduleBase {
  id: number;
  mower_id: number;
  last_maintenance_hours: number;
  last_maintenance_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parts: MaintenancePartRead[];
  next_maintenance_hours?: number;
  next_maintenance_date?: string;
  is_due: boolean;
}

export interface MowingLogRead extends MowingLogBase {
  id: number;
  mower_id: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceLogRead extends MaintenanceLogBase {
  id: number;
  mower_id: number;
  maintenance_schedule_id?: number;
  created_at: string;
  updated_at: string;
  parts_used: MaintenanceLogPartRead[];
}

export interface MowerRead extends MowerBase {
  id: number;
  created_at: string;
  updated_at: string;
  location: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
  };
  total_hours: number;
  next_maintenance_due?: Array<{
    schedule_id: number;
    maintenance_type: string;
    custom_name?: string;
    hours_overdue: number;
    is_overdue: boolean;
  }>;
}

// Update Types
export interface MowerUpdate {
  name?: string;
  brand?: string;
  model?: string;
  year?: number;
  mower_type?: MowerType;
  engine_hours?: number;
  default_mowing_time_minutes?: number;
  notes?: string;
  location_id?: number;
  is_active?: boolean;
}

export interface MowingLogUpdate {
  mowing_date?: string;
  duration_minutes?: number;
  notes?: string;
  lawn_id?: number;
}

export interface MaintenanceScheduleUpdate {
  maintenance_type?: MaintenanceType;
  custom_name?: string;
  interval_hours?: number;
  interval_months?: number;
  notes?: string;
  is_active?: boolean;
}

export interface MaintenanceLogUpdate {
  maintenance_type?: MaintenanceType;
  custom_name?: string;
  maintenance_date?: string;
  hours_at_maintenance?: number;
  total_cost?: number;
  labor_cost?: number;
  performed_by?: string;
  notes?: string;
}

// Specialized Types
export interface MaintenanceDueItem {
  mower_id: number;
  mower_name: string;
  maintenance_schedule_id: number;
  maintenance_type: MaintenanceType;
  custom_name?: string;
  last_maintenance_hours: number;
  current_hours: number;
  hours_overdue: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  is_overdue: boolean;
}

export interface MowerSummary {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  mower_type: MowerType;
  total_hours: number;
  maintenance_due_count: number;
  is_active: boolean;
  location: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
  };
}

// Utility Types
export interface MowerWithStats extends MowerRead {
  total_mowing_sessions: number;
  total_maintenance_sessions: number;
  last_mowing_date?: string;
  last_maintenance_date?: string;
}

export interface MaintenanceScheduleWithStats extends MaintenanceScheduleRead {
  total_performed: number;
  last_performed_date?: string;
  next_due_date?: string;
}

// Form Types
export interface MowerFormData {
  name: string;
  brand: string;
  model: string;
  year: string;
  mower_type: MowerType;
  engine_hours: string;
  default_mowing_time_minutes: string;
  notes: string;
  location_id: string;
  is_active: boolean;
}

export interface MowingLogFormData {
  mowing_date: string;
  duration_minutes: string;
  notes: string;
  lawn_id: string;
}

export interface MaintenanceScheduleFormData {
  maintenance_type: MaintenanceType;
  custom_name: string;
  interval_hours: string;
  interval_months: string;
  notes: string;
  parts: Array<{
    part_name: string;
    part_number: string;
    supplier: string;
    part_url: string;
    estimated_cost: string;
    notes: string;
  }>;
}

export interface MaintenanceLogFormData {
  maintenance_type: MaintenanceType;
  custom_name: string;
  maintenance_date: string;
  hours_at_maintenance: string;
  total_cost: string;
  labor_cost: string;
  performed_by: string;
  notes: string;
  maintenance_schedule_id: string;
  parts_used: Array<{
    part_name: string;
    part_number: string;
    quantity: string;
    unit_cost: string;
    total_cost: string;
    supplier: string;
    notes: string;
  }>;
}
