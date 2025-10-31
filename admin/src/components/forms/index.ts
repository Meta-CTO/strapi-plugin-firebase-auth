// DEBUG: Log re-exports
import { UserFormFields as UserFormFieldsImport } from "./shared/UserFormFields/UserFormFields";
import { UserFormLayout as UserFormLayoutImport } from "./shared/UserFormLayout/UserFormLayout";

console.log("📤 forms/index.ts Re-export Debug:");
console.log("  UserFormFields from import:", UserFormFieldsImport);
console.log("  UserFormFields type:", typeof UserFormFieldsImport);
console.log("  UserFormLayout from import:", UserFormLayoutImport);
console.log("  UserFormLayout type:", typeof UserFormLayoutImport);

export { default as CreateUserForm } from "./CreateUserForm/CreateUserForm";
export { default as EditUserForm } from "./EditUserForm/EditUserForm";
export { UserFormFieldsImport as UserFormFields };
export { UserFormLayoutImport as UserFormLayout };
