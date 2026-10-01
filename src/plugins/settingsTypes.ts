// src/plugins/settingsTypes.ts

export type PluginSettingsField =
  | PluginSettingsAction
  | PluginSettingsText
  | PluginSettingsNumber
  | PluginSettingsToggle
  | PluginSettingsFolderList

export interface PluginSettingsAction {
  type: 'action'
  id: string
  label: string
  description?: string
  variant?: 'default' | 'danger'
}

export interface PluginSettingsText {
  type: 'text'
  id: string
  label: string
  value: string
  placeholder?: string
  description?: string
}

export interface PluginSettingsNumber {
  type: 'number'
  id: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  description?: string
}

export interface PluginSettingsToggle {
  type: 'toggle'
  id: string
  label: string
  value: boolean
  description?: string
}

export interface PluginSettingsFolderList {
  type: 'folderList'
  id: string
  label?: string
  description?: string
  folders: PluginSettingsFolderEntry[]
}

export interface PluginSettingsFolderEntry {
  name: string
  status: 'granted' | 'prompt' | 'denied' | 'unknown'
}

export interface PluginSettingsSection {
  id: string
  title?: string
  description?: string
  fields: PluginSettingsField[]
}

export interface PluginSettingsSchema {
  sections: PluginSettingsSection[]
}
