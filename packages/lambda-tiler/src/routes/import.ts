import { HttpHeader, LambdaHttpRequest, LambdaHttpResponse } from '@linzjs/lambda';
import { Config, Const, fsa } from '@basemaps/shared';
import { createHash } from 'crypto';
import { findImagery, RoleRegister } from '../import/imagery.find.js';
import { Nztm2000Tms, TileMatrixSets } from '@basemaps/geo';
import { getJobCreationContext } from '../import/make.cog.js';
import { ConfigProcessingJob, ConfigProviderDynamo } from '@basemaps/config';
import { CogJobFactory } from '@basemaps/cli';

/**
 * Trigger import imagery job by this endpoint
 *
 * @example
 * - /v1/import?path=s3://linz-imagery-staging/2022-03/wellington_rural_2022_delivery_1
 */
export async function Import(req: LambdaHttpRequest): Promise<LambdaHttpResponse> {
  const path = req.query.get('path');
  const projection = req.query.get('p');

  // Parse projection as target, default to process both NZTM2000Quad
  let targetTms = Nztm2000Tms;
  if (projection != null) {
    const tileMatrix = TileMatrixSets.find(projection);
    if (tileMatrix == null) return new LambdaHttpResponse(404, 'Target projection Not found');
    targetTms = tileMatrix;
  }

  // Find the imagery from s3
  if (path == null || !path.startsWith('s3://')) return new LambdaHttpResponse(500, 'Invalid s3 path');
  const role = await RoleRegister.findRole(path);
  if (role == null) return new LambdaHttpResponse(500, 'Unable to Access the bucket');
  const files = await findImagery(path);
  if (files.length === 0) return new LambdaHttpResponse(404, 'Imagery Not Found');

  // Prepare Cog jobs
  const ctx = await getJobCreationContext(path, targetTms, role, files);

  const id = createHash('sha256').update(JSON.stringify(ctx)).digest('base64');
  const jobId = Config.ProcessingJob.id(id);
  let jobConfig = await Config.ProcessingJob.get(jobId);
  if (jobConfig == null) {
    // Add id back to JobCreationContext
    ctx.override!.id = id;
    ctx.outputLocation.path = fsa.join(ctx.outputLocation.path, id);

    // Start processing job
    await CogJobFactory.create(ctx);
    jobConfig = {
      id: jobId,
      name: path,
      status: 'processing',
    } as ConfigProcessingJob;

    const config = new ConfigProviderDynamo(Const.TileMetadata.TableName);
    await config.ProcessingJob.put(jobConfig);
  }

  const json = JSON.stringify(jobConfig);
  const data = Buffer.from(json);

  const response = new LambdaHttpResponse(200, 'ok');
  response.header(HttpHeader.CacheControl, 'no-store');
  response.buffer(data, 'application/json');
  req.set('bytes', data.byteLength);
  return response;
}