import { ListClustersTool } from "./read/listClusters.js";
import { ListProjectsTool } from "./read/listProjects.js";
import { InspectClusterTool } from "./read/inspectCluster.js";
import { CreateFreeClusterTool } from "./create/createFreeCluster.js";
import { CreateAccessListTool } from "./create/createAccessList.js";
import { InspectAccessListTool } from "./read/inspectAccessList.js";
import { ListDBUsersTool } from "./read/listDBUsers.js";
import { CreateDBUserTool } from "./create/createDBUser.js";
import { CreateProjectTool } from "./create/createProject.js";
import { ListOrganizationsTool } from "./read/listOrgs.js";
import { ConnectClusterTool } from "./metadata/connectCluster.js";
import { LoadSampleDatasetTool } from "./create/loadSampleDataset.js";
import { GetSampleDatasetLoadStatusTool } from "./read/getSampleDatasetLoadStatus.js";
import { DeleteClusterTool } from "./delete/deleteCluster.js";

export const AtlasTools = [
    ListClustersTool,
    ListProjectsTool,
    InspectClusterTool,
    CreateFreeClusterTool,
    CreateAccessListTool,
    InspectAccessListTool,
    ListDBUsersTool,
    CreateDBUserTool,
    CreateProjectTool,
    ListOrganizationsTool,
    ConnectClusterTool,
    LoadSampleDatasetTool,
    GetSampleDatasetLoadStatusTool,
    DeleteClusterTool,
];
