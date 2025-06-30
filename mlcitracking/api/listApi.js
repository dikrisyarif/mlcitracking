// src/api/listApi.js
import { callMitsuiApi } from './apiClient';

export const fetchListDtl = async ({ EmployeeName = '', LeaseNo = '' }) => {
  const endpointPath = '/common/v1/mobile/get-list-dtl';
  const body = { EmployeeName, LeaseNo };

  const result = await callMitsuiApi({ endpointPath, method: 'POST', body });
  return result;
};

// src/api/listApi.js

export const updateCheckin = async ({
  EmployeeName,
  LeaseNo,
  Comment,
  Latitude,
  Longitude,
  CheckIn,
}) => {
  // console.log('mas');
  const endpointPath = '/common/v1/mobile/update-check';

  const body = {
    EmployeeName,
    LeaseNo,
    Comment,
    Latitude: Latitude.toString(),
    Longitude: Longitude.toString(),
    CheckIn: CheckIn, // sudah string lokal
    CreatedDate: new Date().toISOString(),
  };
  console.log('body: ', body);
  const result = await callMitsuiApi({ endpointPath, method: 'PUT', body });
  return result;
};

