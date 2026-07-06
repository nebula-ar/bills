import { ServiceError, ServiceErrorCode } from "./service.errors";
import { findServiceManagementServiceById, updateServiceDetails } from "./service.repository";

export type UpdateGlobalServiceInput = {
  serviceId: string;
  name: string;
  description?: string;
};

export async function updateGlobalService(input: UpdateGlobalServiceInput) {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_SERVICE_NAME);
  }

  const service = await findServiceManagementServiceById(input.serviceId);

  if (!service) {
    throw new ServiceError(ServiceErrorCode.SERVICE_NOT_FOUND);
  }

  const description = input.description?.trim();

  return updateServiceDetails({
    serviceId: service.id,
    name,
    description: description && description.length > 0 ? description : undefined,
  });
}
