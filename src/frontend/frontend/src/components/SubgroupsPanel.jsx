import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBGROUPS_BY_PROJECT } from '../graphql/queries';
import { DELETE_SUBGROUP } from '../graphql/mutations';
import { useAuth } from '../contexts/AuthContext';
import SubgroupSettingsModal from './SubgroupSettingsModal';
import CreateSubgroupModal from './CreateSubgroupModal';
import ConfirmModal from './ConfirmModal';

const SubgroupsPanel = ({ projectId, activeSubgroupId, onSelectSubgroup, isOwner, projectMembers, onRefreshProject }) => {

};

export default SubgroupsPanel;