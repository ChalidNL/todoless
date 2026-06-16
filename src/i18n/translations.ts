export type Language = 'nl' | 'fr' | 'en' | 'de';

export const SUPPORTED_UI_LANGUAGES = ['nl', 'fr', 'en'] as const;
export type SupportedUiLanguage = typeof SUPPORTED_UI_LANGUAGES[number];
export const DEFAULT_UI_LANGUAGE: SupportedUiLanguage = 'en';
const STORAGE_LANGUAGE_KEY = 'app_language';
let activeLanguage: Language = DEFAULT_UI_LANGUAGE;

export function isSupportedUiLanguage(value: unknown): value is SupportedUiLanguage {
  return typeof value === 'string' && (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(value);
}

export function getStoredLanguage(): SupportedUiLanguage {
  if (typeof localStorage === 'undefined') return DEFAULT_UI_LANGUAGE;
  const stored = localStorage.getItem(STORAGE_LANGUAGE_KEY);
  return isSupportedUiLanguage(stored) ? stored : DEFAULT_UI_LANGUAGE;
}

export function setActiveLanguage(lang: Language) {
  activeLanguage = isSupportedUiLanguage(lang) ? lang : DEFAULT_UI_LANGUAGE;
}

export function getActiveLanguage(): Language {
  return activeLanguage;
}


interface TranslationStructure {
  common: {
    add: string;
    addTooltip: string;
    archive: string;
    calendar: string;
    cancel: string;
    clearAllTooltip: string;
    close: string;
    closeEditor: string;
    completed: string;
    confirm: string;
    confirmDeleteTitle: string;
    copied: string;
    copiedToClipboard: string;
    copyToClipboard: string;
    create: string;
    daysLeft: string;
    delete: string;
    dueSoon: string;
    edit: string;
    editTitle: string;
    error: string;
    export: string;
    filter: string;
    filters: string;
    filtersTooltip: string;
    hoursLeft: string;
    groceries: string;
    import: string;
    info: string;
    inbox: string;
    items: string;
    loading: string;
    logout: string;
    markAsDone: string;
    markAsNotDone: string;
    minutesLeft: string;
    no: string;
    noData: string;
    notCompleted: string;
    notes: string;
    openEditor: string;
    overdue: string;
    print: string;
    refresh: string;
    restock: string;
    remove: string;
    retry: string;
    save: string;
    search: string;
    searchDot: string;
    searchTooltip: string;
    settings: string;
    share: string;
    success: string;
    swapType: string;
    tasks: string;
    typeHere: string;
    unknown: string;
    warning: string;
    yes: string;
  };
  onboarding: {
    accountCreationFailed: string;
    confirmPassword: string;
    createAccount: string;
    creatingAccount: string;
    email: string;
    emailAlreadyInUse: string;
    firstName: string;
    getStarted: string;
    goToLogin: string;
    lastName: string;
    next: string;
    password: string;
    passwordDoesNotMeetRequirements: string;
    passwordMinLength: string;
    passwordsDoNotMatch: string;
    pleaseConfirmPassword: string;
    pleaseEnterEmail: string;
    pleaseEnterFirstName: string;
    pleaseEnterPassword: string;
    pleaseEnterWorkspaceName: string;
    prefilledWithWorkspace: string;
    skip: string;
    step1Desc: string;
    step2Desc: string;
    step2Title: string;
    step3Desc: string;
    step3Title: string;
    step4Desc: string;
    step4Title: string;
    stepUserDesc: string;
    stepUserTitle: string;
    welcome: string;
    workspaceName: string;
    workspaceNameMissing: string;
  };
  tasks: {
    [key: string]: string;
  };
  items: {
    title: string;
    newItem: string;
    quantity: string;
    category: string;
    searchPlaceholder: string;
    confirmDelete: string;
    confirmRestock: string;
    empty: string;
    restocked: string;
    sortLabel: string;
    sortCategory: string;
    sortCategoryAlpha: string;
    sortAlpha: string;
  };
  notes: {
    title: string;
    newNote: string;
    content: string;
  };
  filters: {
    title: string;
    noSavedFilters: string;
    manageFilters: string;
  };
  groceries: {
    empty: string;
  };
  settings: {
    account: string;
    active: string;
    addFilter: string;
    addLabel: string;
    addShop: string;
    addedBy: string;
    adminCountWarning: string;
    agentApproval: string;
    agents: string;
    apiDocumentation: string;
    apiTokens: string;
    appInfo: string;
    approve: string;
    approvedCount: string;
    approving: string;
    archiveSettings: string;
    autoCleanup: string;
    blocked: string;
    cancelEdit: string;
    changePassword: string;
    color: string;
    commit: string;
    confirmPassword: string;
    copyAppInfo: string;
    copyFailed: string;
    createApiToken: string;
    created: string;
    currentPassword: string;
    currentPasswordIncorrect: string;
    days30: string;
    days60: string;
    days90: string;
    deleteMember: string;
    deleteMemberConfirm: string;
    demote: string;
    demoteToMember: string;
    disabled: string;
    editProfile: string;
    enabled: string;
    expires: string;
    filterConditions: string;
    filterName: string;
    filterViews: string;
    friday: string;
    integration: string;
    labels: string;
    language: string;
    logOut: string;
    member: string;
    monday: string;
    name: string;
    newPassword: string;
    noApiTokens: string;
    noApiTokensYet: string;
    noPermissions: string;
    noPendingAgents: string;
    noRegisteredAgents: string;
    noSavedFilters: string;
    notifications: string;
    openSwaggerDocs: string;
    admin: string;
    adminOnly: string;
    activate: string;
    you: string;
    autoFamilyJoinHint: string;
    deactivate: string;
    firstAdmin: string;
    makeAdmin: string;
    makeMember: string;
    owner: string;
    password: string;
    passwordMinLength: string;
    passwordMismatch: string;
    passwordRequired: string;
    passwordSame: string;
    passwordUpdated: string;
    pendingCount: string;
    profile: string;
    profileSaveFailed: string;
    reject: string;
    rejectAgentConfirm: string;
    rejecting: string;
    requested: string;
    retentionDays: string;
    retentionPeriod: string;
    revokeToken: string;
    revokeTokenConfirm: string;
    revoking: string;
    role: string;
    saturday: string;
    saveProfile: string;
    selectDay: string;
    selectLanguage: string;
    shops: string;
    sprintSettings: string;
    sprintStartDay: string;
    sunday: string;
    teamMembers: string;
    theme: string;
    thursday: string;
    title: string;
    tokenName: string;
    tokenPermissions: string;
    tuesday: string;
    unblock: string;
    unlimited: string;
    unnamed: string;
    update: string;
    updateAvailable: string;
    updated: string;
    version: string;
    wednesday: string;
    yourProfile: string;
  };
  projects: {
    title: string;
    newProject: string;
    createProject: string;
    projectName: string;
    description: string;
    color: string;
    progress: string;
    tasksCompleted: string;
    tasks: string;
    subtasks: string;
    noProjects: string;
    noProjectsSub: string;
    noTasks: string;
    backToOverview: string;
    statusActive: string;
    statusCompleted: string;
    statusArchived: string;
  };
  invite: {
    agentApiToken: string;
    agentInviteTitle: string;
    agentLabel: string;
    agentTokenAutoGenerated: string;
    close: string;
    codeDeleted: string;
    copyToken: string;
    copyUrl: string;
    delete: string;
    expired: string;
    generate: string;
    generateAgent: string;
    generateFailed: string;
    generateHuman: string;
    generated: string;
    generating: string;
    humanInviteTitle: string;
    humanLabel: string;
    inviteCode: string;
    inviteLink: string;
    minutesRemaining: string;
    saveTokenWarning: string;
    share: string;
    shareFailed: string;
    shareInvite: string;
    shareViaWhatsApp: string;
    urlCopied: string;
    usedOn: string;
  };
  calendar: {
    title: string;
    newEvent: string;
    allDay: string;
    startTime: string;
    endTime: string;
    description: string;
    eventTitle: string;
    saveEvent: string;
    eventDescription: string;
    month: string;
    week: string;
    day: string;
    agenda: string;
    today: string;
    location: string;
    repeat: string;
    noEvents: string;
    datedTask: string;
    searchPlaceholder: string;
    viewLabel: string;
    previous: string;
    next: string;
    moreDetails: string;
    fewerDetails: string;
  };
  inbox: {
    title: string;
    todo: string;
    doneToday: string;
    blocked: string;
    inboxIsEmpty: string;
    selectAll: string;
    deselectAll: string;
    cancelSelection: string;
    pushSelected: string;
    searchPlaceholder: string;
    noTasksFound: string;
    noResults: string;
    markAllDone: string;
    clearAll: string;
    empty: string;
  };
  members: {
    title: string;
    inviteMember: string;
    pendingInvites: string;
    noMembers: string;
    role: string;
    manageMembers: string;
    addMember: string;
    familyLabel: string;
    sameFamilyHint: string;
  };
  agent: {
    title: string;
    createToken: string;
    tokenCreated: string;
    tokenRevoked: string;
    tokenCopied: string;
    saveTokenNow: string;
    pendingApproval: string;
    approved: string;
    rejected: string;
    noAgents: string;
    agentName: string;
    agentEmail: string;
    permissions: string;
    expiresAt: string;
    revokeConfirm: string;
  };
}

export const translations: Record<Language, TranslationStructure> = {
  en: {
    common: {
      add: 'Add',
      addTooltip: 'Add',
      archive: 'Archive',
      calendar: 'Calendar',
      cancel: 'Cancel',
      clearAllTooltip: 'Clear all',
      close: 'Close',
      closeEditor: 'Close Editor',
      completed: 'Completed',
      confirm: 'Confirm',
      confirmDeleteTitle: 'Are you sure you want to delete this?',
      copied: 'Copied!',
      copiedToClipboard: 'Copied to clipboard',
      copyToClipboard: 'Copy to clipboard',
      create: 'Create',
      daysLeft: '{n} days left',
      delete: 'Delete',
      dueSoon: 'Due Soon',
      edit: 'Edit',
      editTitle: 'Edit Title',
      error: 'Error',
      export: 'Export',
      filter: 'Filter',
      filters: 'Filters',
      filtersTooltip: 'Filters',
      hoursLeft: '{n} hours left',
      groceries: 'Groceries',
      import: 'Import',
      info: 'Info',
      inbox: 'Inbox',
      items: 'Items',
      loading: 'Loading...',
      logout: 'Logout',
      markAsDone: 'Mark as Done',
      markAsNotDone: 'Mark as Not Done',
      minutesLeft: '{n} minutes left',
      no: 'No',
      noData: 'No data',
      notCompleted: 'Not Completed',
      notes: 'Notes',
      openEditor: 'Open Editor',
      overdue: 'Overdue',
      print: 'Print',
      refresh: 'Refresh',
      restock: 'Restock',
      remove: 'Remove',
      retry: 'Retry',
      save: 'Save',
      search: 'Search',
      searchDot: 'Search...',
      searchTooltip: 'Search',
      settings: 'Settings',
      share: 'Share',
      success: 'Success',
      swapType: 'Swap Type',
      tasks: 'Tasks',
      typeHere: 'Type here...',
      unknown: 'Unknown',
      warning: 'Warning',
      yes: 'Yes',
    },
    onboarding: {
      accountCreationFailed: 'Account creation failed. Please try again.',
      confirmPassword: 'Confirm password',
      createAccount: 'Create Account',
      creatingAccount: 'Creating account…',
      email: 'Email',
      emailAlreadyInUse: 'This email is already in use. Try logging in.',
      firstName: 'First name *',
      getStarted: 'Get Started',
      goToLogin: 'Go to login',
      lastName: 'Last name',
      next: 'Next',
      password: 'Password',
      passwordDoesNotMeetRequirements: 'Password does not meet requirements: minimum 8 characters',
      passwordMinLength: 'Password must be at least 8 characters',
      passwordsDoNotMatch: 'Passwords do not match',
      pleaseConfirmPassword: 'Please confirm your password',
      pleaseEnterEmail: 'Please enter your email',
      pleaseEnterFirstName: 'Please enter your first name',
      pleaseEnterPassword: 'Please enter a password',
      pleaseEnterWorkspaceName: 'Please enter a workspace name',
      prefilledWithWorkspace: 'Pre-filled with your workspace name, you can change it',
      skip: 'Skip',
      step1Desc: 'Your daily assistant for quick, simple productivity without overwhelm.',
      step2Desc: 'Track groceries with quantities and stores. Keep your shopping list simple and organized.',
      step2Title: 'Simple Groceries',
      step3Desc: 'Give your household a name. This is the main entity all members share.',
      step3Title: 'Name Your Workspace',
      step4Desc: 'Set up your administrator account to get started.',
      step4Title: 'Create Admin Account',
      stepUserDesc: 'Ready to unload your mind and get organized?',
      stepUserTitle: "Let's Start",
      welcome: 'Welcome to todoless-ngx',
      workspaceName: 'Workspace name',
      workspaceNameMissing: 'Workspace name is missing — go back and enter it',
    },
    tasks: {
      title: 'Tasks',
      newTask: 'New Task',
      dueDate: 'Due Date',
      assignee: 'Assignee',
      labels: 'Labels',
      priority: 'Priority',
      status: 'Status',
      completed: 'Completed',
      inProgress: 'In Progress',
      todo: 'To Do',
      comment: 'Comment',
      focus: 'Focus',
      commentPlaceholder: 'Add context or a blocker note…',
      commentRequiredForFlag: 'Add a comment before flagging this task.',
      addCommentAndFlag: 'Add comment & flag',
      subtasks: 'Sub-tasks',
      subtaskAdded: 'Sub-task added',
      failedToCreateSubtask: 'Failed to create sub-task',
      newSubtaskTitle: 'New sub-task title',
      addSubtask: 'Add sub-task',
      markSubtaskAsDone: 'Mark sub-task as done',
      markSubtaskAsNotDone: 'Mark sub-task as not done',
      subtasksTooltip: 'Sub-tasks',
      viewSubtasks: 'View sub-tasks',
    },
    items: {
      title: 'Items',
      newItem: 'New Item',
      quantity: 'Quantity',
      category: 'Category',
      searchPlaceholder: 'Search items...',
      confirmDelete: 'Delete this item?',
      confirmRestock: 'Restock all completed groceries?',
      empty: 'Empty',
      restocked: 'Groceries restocked',
      sortLabel: 'Sort',
      sortCategory: 'By category',
      sortCategoryAlpha: 'Category A-Z',
      sortAlpha: 'A-Z',
    },
    notes: {
      title: 'Notes',
      newNote: 'New Note',
      content: 'Content',
    },
    filters: {
      title: 'Filters',
      noSavedFilters: 'No saved filters',
      manageFilters: 'Manage your saved filters here.',
    },
    groceries: {
      empty: 'No items yet',
    },
    settings: {
      account: 'Account',
      active: 'Active',
      addFilter: 'Add Filter',
      addLabel: 'Add Label',
      addShop: 'Add Shop',
      addedBy: 'Added by',
      adminCountWarning: 'Warning: changing admin count',
      agentApproval: 'Agent Approval',
      agents: 'Agents',
      apiDocumentation: 'API Documentation',
      apiTokens: 'API Tokens',
      appInfo: 'App Info',
      approve: 'Approve',
      approvedCount: 'Approved',
      approving: 'Approving...',
      archiveSettings: 'Archive Settings',
      autoCleanup: 'Auto Cleanup',
      blocked: 'Blocked',
      cancelEdit: 'Cancel',
      changePassword: 'Change Password',
      color: 'Color',
      commit: 'Commit',
      confirmPassword: 'Confirm Password',
      copyAppInfo: 'Copy',
      copyFailed: 'Copy failed',
      createApiToken: 'Create API Token',
      created: 'Created',
      currentPassword: 'Current Password',
      currentPasswordIncorrect: 'Current password is incorrect',
      days30: '30 days',
      days60: '60 days',
      days90: '90 days',
      deleteMember: 'Delete Member',
      deleteMemberConfirm: 'Are you sure you want to delete this member?',
      demote: 'Demote',
      demoteToMember: 'Demote to Member',
      disabled: 'Disabled',
      editProfile: 'Edit Profile',
      enabled: 'Enabled',
      expires: 'Expires',
      filterConditions: 'Filter Conditions',
      filterName: 'Filter Name',
      filterViews: 'Filter Views',
      friday: 'Friday',
      integration: 'Integration',
      labels: 'Labels',
      language: 'Language',
      logOut: 'Log Out',
      member: 'Member',
      monday: 'Monday',
      name: 'Name',
      newPassword: 'New Password',
      noApiTokens: 'No API tokens',
      noApiTokensYet: 'No API tokens yet',
      noPermissions: 'No permissions',
      noPendingAgents: 'No pending agents',
      noRegisteredAgents: 'No registered agents',
      noSavedFilters: 'No saved filters',
      notifications: 'Notifications',
      openSwaggerDocs: 'Open Swagger Docs',
      admin: 'Admin',
      adminOnly: 'Admin only',
      activate: 'Activate',
      you: 'You',
      autoFamilyJoinHint: 'New members automatically join this family.',
      deactivate: 'Deactivate',
      firstAdmin: 'First admin',
      makeAdmin: 'Make admin',
      makeMember: 'Make member',
      owner: 'Owner',
      password: 'Password',
      passwordMinLength: 'Password must be at least {n} characters',
      passwordMismatch: 'Passwords do not match',
      passwordRequired: 'Password is required',
      passwordSame: 'New password must be different from current',
      passwordUpdated: 'Password updated successfully',
      pendingCount: 'Pending',
      profile: 'Profile',
      profileSaveFailed: 'Failed to save profile',
      reject: 'Reject',
      rejectAgentConfirm: 'Are you sure you want to reject this agent?',
      rejecting: 'Rejecting...',
      requested: 'Requested',
      retentionDays: 'Retention Days',
      retentionPeriod: 'Retention Period',
      revokeToken: 'Revoke Token',
      revokeTokenConfirm: 'Are you sure you want to revoke this token?',
      revoking: 'Revoking...',
      role: 'Role',
      saturday: 'Saturday',
      saveProfile: 'Save',
      selectDay: 'Select Day',
      selectLanguage: 'Select Language',
      shops: 'Shops',
      sprintSettings: 'Sprint Settings',
      sprintStartDay: 'Sprint Start Day',
      sunday: 'Sunday',
      teamMembers: 'Team Members',
      theme: 'Theme',
      thursday: 'Thursday',
      title: 'Settings',
      tokenName: 'Token Name',
      tokenPermissions: 'Token Permissions',
      tuesday: 'Tuesday',
      unblock: 'Unblock',
      unlimited: 'Unlimited',
      unnamed: 'Unnamed',
      update: 'Update',
      updateAvailable: 'A new version is available',
      updated: 'Updated',
      version: 'Version',
      wednesday: 'Wednesday',
      yourProfile: 'Your Profile',
    },
    projects: {
      title: 'Projects',
      newProject: 'New Project',
      createProject: 'Create Project',
      projectName: 'Project name',
      description: 'Description',
      color: 'Color',
      progress: 'Progress',
      tasksCompleted: 'tasks completed',
      tasks: 'tasks',
      subtasks: 'Sub-tasks',
      noProjects: 'No projects yet',
      noProjectsSub: 'Create your first project to get started',
      noTasks: 'No sub-tasks in this project',
      backToOverview: 'Back to overview',
      statusActive: 'Active',
      statusCompleted: 'Completed',
      statusArchived: 'Archived',
    },
    invite: {
      agentApiToken: '🔑 Agent API Token',
      agentInviteTitle: 'Agent Invite',
      agentLabel: 'Agent',
      agentTokenAutoGenerated: 'An API token will be generated automatically for this agent invite.',
      close: 'Close',
      codeDeleted: 'Invite code deleted',
      copyToken: 'Copy token',
      copyUrl: 'Copy URL',
      delete: 'Delete',
      expired: 'Expired',
      generate: 'Generate Invite Code',
      generateAgent: 'Generate Agent Invite',
      generateFailed: 'Failed to generate invite code',
      generateHuman: 'Generate Human Invite',
      generated: '{type} generated',
      generating: 'Generating...',
      humanInviteTitle: 'Share Human Invite',
      humanLabel: 'Human',
      inviteCode: 'Invite Code',
      inviteLink: 'Invite Link',
      minutesRemaining: '{n} minutes remaining',
      saveTokenWarning: 'Save this token now — it will not be shown again. The agent will be pending until you approve it.',
      share: 'Share',
      shareFailed: 'Share failed',
      shareInvite: 'Share Invite',
      shareViaWhatsApp: 'Share via WhatsApp',
      urlCopied: 'URL copied!',
      usedOn: 'Used on {date}',
    },
    calendar: {
      title: 'Calendar',
      newEvent: 'New event…',
      allDay: 'All Day',
      startTime: 'Start Time',
      endTime: 'End Time',
      description: 'Description',
      eventTitle: 'Event Title',
      saveEvent: 'Save event',
      eventDescription: 'Event Description',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      agenda: 'Agenda',
      today: 'Today',
      location: 'Location',
      repeat: 'Repeat',
      noEvents: 'No calendar items',
      datedTask: 'Task',
      searchPlaceholder: 'Search calendar...',
      viewLabel: 'Calendar view',
      previous: 'Previous',
      next: 'Next',
      moreDetails: 'More details',
      fewerDetails: 'Fewer details',
    },
    inbox: {
      title: 'Inbox',
      todo: 'To Do',
      doneToday: 'Done Today',
      blocked: 'Blocked',
      inboxIsEmpty: 'Inbox is empty',
      selectAll: 'Select All',
      deselectAll: 'Deselect All',
      cancelSelection: 'Cancel Selection',
      pushSelected: 'Push Selected',
      searchPlaceholder: 'Search inbox...',
      noTasksFound: 'No tasks found',
      noResults: 'No results',
      markAllDone: 'Mark All Done',
      clearAll: 'Clear All',
      empty: 'Empty',
    },
    members: {
      title: 'Members',
      inviteMember: 'Invite Member',
      pendingInvites: 'Pending Invites',
      noMembers: 'No members',
      role: 'Role',
      manageMembers: 'Manage Members',
      addMember: 'Add Member',
      familyLabel: 'Family',
      sameFamilyHint: 'Only members from the same family are shown here.',
    },
    agent: {
      title: 'Agents',
      createToken: 'Create Token',
      tokenCreated: 'Token created successfully',
      tokenRevoked: 'Token revoked',
      tokenCopied: 'Token copied to clipboard',
      saveTokenNow: 'Please save this token now',
      pendingApproval: 'Pending Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      noAgents: 'No agents',
      agentName: 'Agent Name',
      agentEmail: 'Agent Email',
      permissions: 'Permissions',
      expiresAt: 'Expires At',
      revokeConfirm: 'Are you sure you want to revoke this token?',
    },
  },
  fr: {
    common: {
      add: 'Ajouter',
      addTooltip: 'Ajouter',
      archive: 'Archiver',
      calendar: 'Calendrier',
      cancel: 'Annuler',
      clearAllTooltip: 'Tout effacer',
      close: 'Fermer',
      closeEditor: 'Fermer l\'éditeur',
      completed: 'Terminé',
      confirm: 'Confirmer',
      confirmDeleteTitle: 'Êtes-vous sûr de vouloir supprimer ceci ?',
      copied: 'Copié !',
      copiedToClipboard: 'Copié dans le presse-papier',
      copyToClipboard: 'Copier dans le presse-papier',
      create: 'Créer',
      daysLeft: '{n} jours restants',
      delete: 'Supprimer',
      dueSoon: 'Bientôt due',
      edit: 'Modifier',
      editTitle: 'Modifier le titre',
      error: 'Erreur',
      export: 'Exporter',
      filter: 'Filtrer',
      filters: 'Filtres',
      filtersTooltip: 'Filtres',
      hoursLeft: '{n} heures restantes',
      groceries: 'Courses',
      import: 'Importer',
      info: 'Infos',
      inbox: 'Boîte de réception',
      items: 'Articles',
      loading: 'Chargement...',
      logout: 'Déconnexion',
      markAsDone: 'Marquer comme terminé',
      markAsNotDone: 'Marquer comme non terminé',
      minutesLeft: '{n} minutes restantes',
      no: 'Non',
      noData: 'Aucune donnée',
      notCompleted: 'Non terminé',
      notes: 'Notes',
      openEditor: 'Ouvrir l\'éditeur',
      overdue: 'En retard',
      print: 'Imprimer',
      refresh: 'Actualiser',
      restock: 'Réranger',
      remove: 'Supprimer',
      retry: 'Réessayer',
      save: 'Enregistrer',
      search: 'Rechercher',
      searchDot: 'Rechercher...',
      searchTooltip: 'Rechercher',
      settings: 'Paramètres',
      share: 'Partager',
      success: 'Succès',
      swapType: 'Changer de type',
      tasks: 'Tâches',
      typeHere: 'Tapez ici...',
      unknown: 'Inconnu',
      warning: 'Avertissement',
      yes: 'Oui',
    },
    onboarding: {
      accountCreationFailed: 'Échec de la création du compte. Veuillez réessayer.',
      confirmPassword: 'Confirmer le mot de passe',
      createAccount: 'Créer un compte',
      creatingAccount: 'Création du compte…',
      email: 'E-mail',
      emailAlreadyInUse: 'Cet e-mail est déjà utilisé. Essayez de vous connecter.',
      firstName: 'Prénom *',
      getStarted: 'Commencer',
      goToLogin: 'Aller à la connexion',
      lastName: 'Nom de famille',
      next: 'Suivant',
      password: 'Mot de passe',
      passwordDoesNotMeetRequirements: 'Le mot de passe ne répond pas aux exigences : minimum 8 caractères',
      passwordMinLength: 'Le mot de passe doit contenir au moins 8 caractères',
      passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
      pleaseConfirmPassword: 'Veuillez confirmer votre mot de passe',
      pleaseEnterEmail: 'Veuillez saisir votre e-mail',
      pleaseEnterFirstName: 'Veuillez saisir votre prénom',
      pleaseEnterPassword: 'Veuillez saisir un mot de passe',
      pleaseEnterWorkspaceName: 'Veuillez saisir un nom d\'espace de travail',
      prefilledWithWorkspace: 'Pré-rempli avec le nom de votre espace de travail, vous pouvez le modifier',
      skip: 'Passer',
      step1Desc: 'Votre assistant quotidien pour une productivité rapide et simple sans surcharge.',
      step2Desc: 'Suivez les courses avec les quantités et les magasins. Gardez votre liste de courses simple et organisée.',
      step2Title: 'Courses Simples',
      step3Desc: 'Donnez un nom à votre foyer. C\'est l\'entité principale que tous les membres partagent.',
      step3Title: 'Nommez Votre Espace de Travail',
      step4Desc: 'Configurez votre compte administrateur pour commencer.',
      step4Title: 'Créer un Compte Administrateur',
      stepUserDesc: 'Prêt à libérer votre esprit et à vous organiser ?',
      stepUserTitle: 'C\'est Parti',
      welcome: 'Bienvenue sur todoless-ngx',
      workspaceName: 'Nom de l\'espace de travail',
      workspaceNameMissing: 'Le nom de l\'espace de travail est manquant — revenez en arrière et saisissez-le',
    },
    tasks: {
      title: 'Tâches',
      newTask: 'Nouvelle tâche',
      dueDate: "Date d'échéance",
      assignee: 'Assigné à',
      labels: 'Étiquettes',
      priority: 'Priorité',
      status: 'Statut',
      completed: 'Terminé',
      inProgress: 'En cours',
      todo: 'À faire',
      comment: 'Commentaire',
      focus: 'Focus',
      commentPlaceholder: 'Ajoutez du contexte ou un blocage…',
      commentRequiredForFlag: 'Ajoutez un commentaire avant de signaler cette tâche.',
      addCommentAndFlag: 'Ajouter un commentaire et signaler',
      subtasks: 'Sous-tâches',
      subtaskAdded: 'Sous-tâche ajoutée',
      failedToCreateSubtask: 'Échec de création de la sous-tâche',
      newSubtaskTitle: 'Nouveau titre de sous-tâche',
      addSubtask: 'Ajouter une sous-tâche',
      markSubtaskAsDone: 'Marquer la sous-tâche comme terminée',
      markSubtaskAsNotDone: 'Marquer la sous-tâche comme non terminée',
      subtasksTooltip: 'Sous-tâches',
      viewSubtasks: 'Voir les sous-tâches',
    },
    items: {
      title: 'Articles',
      newItem: 'Nouvel article',
      quantity: 'Quantité',
      category: 'Catégorie',
      searchPlaceholder: 'Rechercher des articles...',
      confirmDelete: 'Supprimer cet article ?',
      confirmRestock: 'Remettre tous les articles terminés en stock ?',
      empty: 'Vide',
      restocked: 'Courses réapprovisionnées',
      sortLabel: 'Trier',
      sortCategory: 'Par catégorie',
      sortCategoryAlpha: 'Catégorie A-Z',
      sortAlpha: 'A-Z',
    },
    notes: {
      title: 'Notes',
      newNote: 'Nouvelle note',
      content: 'Contenu',
    },
    filters: {
      title: 'Filtres',
      noSavedFilters: 'Aucun filtre enregistré',
      manageFilters: 'Gérez vos filtres enregistrés ici.',
    },
    groceries: {
      empty: 'Aucun article',
    },
    settings: {
      account: 'Compte',
      active: 'Actif',
      addFilter: 'Ajouter un filtre',
      addLabel: 'Ajouter une étiquette',
      addShop: 'Ajouter un magasin',
      addedBy: 'Ajouté par',
      adminCountWarning: 'Attention : modification du nombre d\'administrateurs',
      agentApproval: 'Approbation d\'agent',
      agents: 'Agents',
      apiDocumentation: 'Documentation API',
      apiTokens: 'Jetons API',
      appInfo: 'Info application',
      approve: 'Approuver',
      approvedCount: 'Approuvé',
      approving: 'Approbation...',
      archiveSettings: 'Paramètres d\'archivage',
      autoCleanup: 'Nettoyage automatique',
      blocked: 'Bloqué',
      cancelEdit: 'Annuler',
      changePassword: 'Changer le mot de passe',
      color: 'Couleur',
      commit: 'Commit',
      confirmPassword: 'Confirmer le mot de passe',
      copyAppInfo: 'Copier',
      copyFailed: 'Échec de la copie',
      createApiToken: 'Créer un jeton API',
      created: 'Créé',
      currentPassword: 'Mot de passe actuel',
      currentPasswordIncorrect: 'Le mot de passe actuel est incorrect',
      days30: '30 jours',
      days60: '60 jours',
      days90: '90 jours',
      deleteMember: 'Supprimer le membre',
      deleteMemberConfirm: 'Êtes-vous sûr de vouloir supprimer ce membre ?',
      demote: 'Rétrograder',
      demoteToMember: 'Rétrograder en membre',
      disabled: 'Désactivé',
      editProfile: 'Modifier le profil',
      enabled: 'Activé',
      expires: 'Expire',
      filterConditions: 'Conditions du filtre',
      filterName: 'Nom du filtre',
      filterViews: 'Vues filtrées',
      friday: 'Vendredi',
      integration: 'Intégration',
      labels: 'Étiquettes',
      language: 'Langue',
      logOut: 'Déconnexion',
      member: 'Membre',
      monday: 'Lundi',
      name: 'Nom',
      newPassword: 'Nouveau mot de passe',
      noApiTokens: 'Aucun jeton API',
      noApiTokensYet: 'Pas encore de jetons API',
      noPermissions: 'Aucune permission',
      noPendingAgents: 'Aucun agent en attente',
      noRegisteredAgents: 'Aucun agent enregistré',
      noSavedFilters: 'Aucun filtre enregistré',
      notifications: 'Notifications',
      openSwaggerDocs: 'Ouvrir la documentation Swagger',
      admin: 'Admin',
      adminOnly: 'Admin uniquement',
      activate: 'Activer',
      you: 'Vous',
      autoFamilyJoinHint: 'Les nouveaux membres rejoignent automatiquement cette famille.',
      deactivate: 'Désactiver',
      firstAdmin: 'Premier admin',
      makeAdmin: 'Nommer admin',
      makeMember: 'Nommer membre',
      owner: 'Propriétaire',
      password: 'Mot de passe',
      passwordMinLength: 'Le mot de passe doit contenir au moins {n} caractères',
      passwordMismatch: 'Les mots de passe ne correspondent pas',
      passwordRequired: 'Le mot de passe est requis',
      passwordSame: 'Le nouveau mot de passe doit être différent de l\'actuel',
      passwordUpdated: 'Mot de passe mis à jour avec succès',
      pendingCount: 'En attente',
      profile: 'Profil',
      profileSaveFailed: 'Échec de la sauvegarde du profil',
      reject: 'Rejeter',
      rejectAgentConfirm: 'Êtes-vous sûr de vouloir rejeter cet agent ?',
      rejecting: 'Rejet...',
      requested: 'Demandé',
      retentionDays: 'Jours de conservation',
      retentionPeriod: 'Période de conservation',
      revokeToken: 'Révoquer le jeton',
      revokeTokenConfirm: 'Êtes-vous sûr de vouloir révoquer ce jeton ?',
      revoking: 'Révocation...',
      role: 'Rôle',
      saturday: 'Samedi',
      saveProfile: 'Enregistrer',
      selectDay: 'Sélectionner le jour',
      selectLanguage: 'Sélectionner la langue',
      shops: 'Magasins',
      sprintSettings: 'Paramètres de sprint',
      sprintStartDay: 'Jour de début du sprint',
      sunday: 'Dimanche',
      teamMembers: 'Membres de l\'équipe',
      theme: 'Thème',
      thursday: 'Jeudi',
      title: 'Paramètres',
      tokenName: 'Nom du jeton',
      tokenPermissions: 'Permissions du jeton',
      tuesday: 'Mardi',
      unblock: 'Débloquer',
      unlimited: 'Illimité',
      unnamed: 'Sans nom',
      update: 'Mettre à jour',
      updateAvailable: 'Une nouvelle version est disponible',
      updated: 'Mis à jour',
      version: 'Version',
      wednesday: 'Mercredi',
      yourProfile: 'Votre profil',
    },
    projects: {
      title: 'Projets',
      newProject: 'Nouveau projet',
      createProject: 'Créer un projet',
      projectName: 'Nom du projet',
      description: 'Description',
      color: 'Couleur',
      progress: 'Progrès',
      tasksCompleted: 'tâches terminées',
      tasks: 'tâches',
      subtasks: 'Sous-tâches',
      noProjects: 'Pas encore de projets',
      noProjectsSub: 'Créez votre premier projet pour commencer',
      noTasks: 'Pas de sous-tâches dans ce projet',
      backToOverview: 'Retour à l\'aperçu',
      statusActive: 'Actif',
      statusCompleted: 'Terminé',
      statusArchived: 'Archivé',
    },
    invite: {
      agentApiToken: '🔑 Jeton API Agent',
      agentInviteTitle: 'Invitation Agent',
      agentLabel: 'Agent',
      agentTokenAutoGenerated: 'Un jeton API sera généré automatiquement pour cette invitation d\'agent.',
      close: 'Fermer',
      codeDeleted: 'Code d\'invitation supprimé',
      copyToken: 'Copier le jeton',
      copyUrl: 'Copier l\'URL',
      delete: 'Supprimer',
      expired: 'Expiré',
      generate: 'Générer un code d\'invitation',
      generateAgent: 'Générer une invitation Agent',
      generateFailed: 'Échec de la génération du code d\'invitation',
      generateHuman: 'Générer une invitation Humain',
      generated: '{type} généré',
      generating: 'Génération...',
      humanInviteTitle: 'Partager l\'invitation Humain',
      humanLabel: 'Humain',
      inviteCode: 'Code d\'invitation',
      inviteLink: 'Lien d\'invitation',
      minutesRemaining: 'Encore {n} minutes',
      saveTokenWarning: 'Sauvegardez ce jeton maintenant — il ne sera plus affiché. L\'agent sera en attente jusqu\'à votre approbation.',
      share: 'Partager',
      shareFailed: 'Échec du partage',
      shareInvite: 'Partager l\'invitation',
      shareViaWhatsApp: 'Partager via WhatsApp',
      urlCopied: 'URL copiée !',
      usedOn: 'Utilisé le {date}',
    },
    calendar: {
      title: 'Calendrier',
      newEvent: 'Nouvel événement…',
      allDay: 'Toute la journée',
      startTime: 'Heure de début',
      endTime: 'Heure de fin',
      description: 'Description',
      eventTitle: 'Titre de l\'événement',
      saveEvent: 'Enregistrer l\'événement',
      eventDescription: 'Description de l\'événement',
      month: 'Mois',
      week: 'Semaine',
      day: 'Jour',
      agenda: 'Agenda',
      today: 'Aujourd’hui',
      location: 'Lieu',
      repeat: 'Répéter',
      noEvents: 'Aucun élément d’agenda',
      datedTask: 'Tâche',
      searchPlaceholder: 'Rechercher dans l’agenda...',
      viewLabel: 'Vue calendrier',
      previous: 'Précédent',
      next: 'Suivant',
      moreDetails: 'Plus de détails',
      fewerDetails: 'Moins de détails',
    },
    inbox: {
      title: 'Boîte de réception',
      todo: 'À faire',
      doneToday: 'Fait aujourd\'hui',
      blocked: 'Bloqué',
      inboxIsEmpty: 'La boîte de réception est vide',
      selectAll: 'Tout sélectionner',
      deselectAll: 'Tout désélectionner',
      cancelSelection: 'Annuler la sélection',
      pushSelected: 'Pousser la sélection',
      searchPlaceholder: 'Rechercher dans la boîte de réception...',
      noTasksFound: 'Aucune tâche trouvée',
      noResults: 'Aucun résultat',
      markAllDone: 'Tout marquer comme fait',
      clearAll: 'Tout effacer',
      empty: 'Vide',
    },
    members: {
      title: 'Membres',
      inviteMember: 'Inviter un membre',
      pendingInvites: 'Invitations en attente',
      noMembers: 'Aucun membre',
      role: 'Rôle',
      manageMembers: 'Gérer les membres',
      addMember: 'Ajouter un membre',
      familyLabel: 'Famille',
      sameFamilyHint: 'Seuls les membres de la même famille sont affichés ici.',
    },
    agent: {
      title: 'Agents',
      createToken: 'Créer un jeton',
      tokenCreated: 'Jeton créé avec succès',
      tokenRevoked: 'Jeton révoqué',
      tokenCopied: 'Jeton copié dans le presse-papier',
      saveTokenNow: 'Veuillez sauvegarder ce jeton maintenant',
      pendingApproval: 'En attente d\'approbation',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      noAgents: 'Aucun agent',
      agentName: 'Nom de l\'agent',
      agentEmail: 'Email de l\'agent',
      permissions: 'Permissions',
      expiresAt: 'Expire le',
      revokeConfirm: 'Êtes-vous sûr de vouloir révoquer ce jeton ?',
    },
  },
  nl: {
    common: {
      add: 'Toevoegen',
      addTooltip: 'Toevoegen',
      archive: 'Archiveren',
      calendar: 'Kalender',
      cancel: 'Annuleren',
      clearAllTooltip: 'Alles wissen',
      close: 'Sluiten',
      closeEditor: 'Editor sluiten',
      completed: 'Voltooid',
      confirm: 'Bevestigen',
      confirmDeleteTitle: 'Weet je zeker dat je dit wilt verwijderen?',
      copied: 'Gekopieerd!',
      copiedToClipboard: 'Gekopieerd naar klembord',
      copyToClipboard: 'Kopiëren naar klembord',
      create: 'Aanmaken',
      daysLeft: '{n} dagen over',
      delete: 'Verwijderen',
      dueSoon: 'Binnenkort vervallen',
      edit: 'Bewerken',
      editTitle: 'Titel bewerken',
      error: 'Fout',
      export: 'Exporteren',
      filter: 'Filteren',
      filters: 'Filters',
      filtersTooltip: 'Filters',
      hoursLeft: '{n} uur over',
      groceries: 'Boodschappen',
      import: 'Importeren',
      info: 'Info',
      inbox: 'Inbox',
      items: 'Items',
      loading: 'Laden...',
      logout: 'Uitloggen',
      markAsDone: 'Markeren als voltooid',
      markAsNotDone: 'Markeren als niet voltooid',
      minutesLeft: '{n} minuten over',
      no: 'Nee',
      noData: 'Geen gegevens',
      notCompleted: 'Niet voltooid',
      notes: 'Notities',
      openEditor: 'Editor openen',
      overdue: 'Verlopen',
      print: 'Afdrukken',
      refresh: 'Vernieuwen',
      restock: 'Restock',
      remove: 'Verwijderen',
      retry: 'Opnieuw proberen',
      save: 'Opslaan',
      search: 'Zoeken',
      searchDot: 'Zoeken...',
      searchTooltip: 'Zoeken',
      settings: 'Instellingen',
      share: 'Delen',
      success: 'Succes',
      swapType: 'Type wisselen',
      tasks: 'Taken',
      typeHere: 'Typ hier...',
      unknown: 'Onbekend',
      warning: 'Waarschuwing',
      yes: 'Ja',
    },
    onboarding: {
      accountCreationFailed: 'Account aanmaken mislukt. Probeer het opnieuw.',
      confirmPassword: 'Bevestig wachtwoord',
      createAccount: 'Account aanmaken',
      creatingAccount: 'Account aanmaken…',
      email: 'E-mail',
      emailAlreadyInUse: 'Dit e-mailadres is al in gebruik. Probeer in te loggen.',
      firstName: 'Voornaam *',
      getStarted: 'Aan de slag',
      goToLogin: 'Naar inloggen',
      lastName: 'Achternaam',
      next: 'Volgende',
      password: 'Wachtwoord',
      passwordDoesNotMeetRequirements: 'Wachtwoord voldoet niet aan de vereisten: minimaal 8 tekens',
      passwordMinLength: 'Wachtwoord moet minimaal 8 tekens bevatten',
      passwordsDoNotMatch: 'Wachtwoorden komen niet overeen',
      pleaseConfirmPassword: 'Bevestig uw wachtwoord',
      pleaseEnterEmail: 'Voer uw e-mail in',
      pleaseEnterFirstName: 'Voer uw voornaam in',
      pleaseEnterPassword: 'Voer een wachtwoord in',
      pleaseEnterWorkspaceName: 'Voer een workspace naam in',
      prefilledWithWorkspace: 'Vooringevuld met uw workspace naam, u kunt het wijzigen',
      skip: 'Overslaan',
      step1Desc: 'Uw dagelijkse assistent voor snelle, eenvoudige productiviteit zonder overweldiging.',
      step2Desc: 'Volg boodschappen met hoeveelheden en winkels. Houd uw boodschappenlijst eenvoudig en georganiseerd.',
      step2Title: 'Eenvoudige Boodschappen',
      step3Desc: 'Geef uw huishouden een naam. Dit is de hoofdentiteit die alle leden delen.',
      step3Title: 'Noem Uw Werkruimte',
      step4Desc: 'Stel uw beheerdersaccount in om te beginnen.',
      step4Title: 'Beheerdersaccount Aanmaken',
      stepUserDesc: 'Klaar om uw geest te ontlasten en georganiseerd te worden?',
      stepUserTitle: 'Laten We Beginnen',
      welcome: 'Welkom bij todoless-ngx',
      workspaceName: 'Werkruimte naam',
      workspaceNameMissing: 'Werkruimte naam ontbreekt — ga terug en voer het in',
    },
    tasks: {
      title: 'Taken',
      newTask: 'Nieuwe taak',
      dueDate: 'Verloopdatum',
      assignee: 'Toegewezen aan',
      labels: 'Labels',
      priority: 'Prioriteit',
      status: 'Status',
      completed: 'Voltooid',
      inProgress: 'Bezig',
      todo: 'Te doen',
      comment: 'Commentaar',
      focus: 'Focus',
      commentPlaceholder: 'Voeg context of een blokkade toe…',
      commentRequiredForFlag: 'Voeg eerst een commentaar toe voordat je deze taak flagt.',
      addCommentAndFlag: 'Commentaar toevoegen en flaggen',
      subtasks: 'Sub-taken',
      subtaskAdded: 'Sub-taak toegevoegd',
      failedToCreateSubtask: 'Sub-taak aanmaken mislukt',
      newSubtaskTitle: 'Nieuwe sub-taak titel',
      addSubtask: 'Sub-taak toevoegen',
      markSubtaskAsDone: 'Sub-taak markeren als voltooid',
      markSubtaskAsNotDone: 'Sub-taak markeren als niet voltooid',
      subtasksTooltip: 'Sub-taken',
      viewSubtasks: 'Sub-taken bekijken',
    },
    items: {
      title: 'Items',
      newItem: 'Nieuw item',
      quantity: 'Hoeveelheid',
      category: 'Categorie',
      searchPlaceholder: 'Items zoeken...',
      confirmDelete: 'Dit item verwijderen?',
      confirmRestock: 'Alle afgewerkte boodschappen opnieuw aanvullen?',
      empty: 'Leeg',
      restocked: 'Boodschappen opnieuw aangevuld',
      sortLabel: 'Sorteren',
      sortCategory: 'Per categorie',
      sortCategoryAlpha: 'Categorie A-Z',
      sortAlpha: 'A-Z',
    },
    notes: {
      title: 'Notities',
      newNote: 'Nieuwe notitie',
      content: 'Inhoud',
    },
    filters: {
      title: 'Filters',
      noSavedFilters: 'Geen opgeslagen filters',
      manageFilters: 'Beheer je opgeslagen filters hier.',
    },
    groceries: {
      empty: 'Geen items',
    },
    settings: {
      account: 'Account',
      active: 'Actief',
      addFilter: 'Filter toevoegen',
      addLabel: 'Label toevoegen',
      addShop: 'Winkel toevoegen',
      addedBy: 'Toegevoegd door',
      adminCountWarning: 'Waarschuwing: wijzigen aantal beheerders',
      agentApproval: 'Agent goedkeuring',
      agents: 'Agenten',
      apiDocumentation: 'API Documentatie',
      apiTokens: 'API Tokens',
      appInfo: 'App Info',
      approve: 'Goedkeuren',
      approvedCount: 'Goedgekeurd',
      approving: 'Goedkeuren...',
      archiveSettings: 'Archief instellingen',
      autoCleanup: 'Automatisch opruimen',
      blocked: 'Geblokkeerd',
      cancelEdit: 'Annuleren',
      changePassword: 'Wachtwoord wijzigen',
      color: 'Kleur',
      commit: 'Commit',
      confirmPassword: 'Bevestig wachtwoord',
      copyAppInfo: 'Kopiëren',
      copyFailed: 'Kopiëren mislukt',
      createApiToken: 'API Token aanmaken',
      created: 'Aangemaakt',
      currentPassword: 'Huidig wachtwoord',
      currentPasswordIncorrect: 'Huidig wachtwoord is onjuist',
      days30: '30 dagen',
      days60: '60 dagen',
      days90: '90 dagen',
      deleteMember: 'Lid verwijderen',
      deleteMemberConfirm: 'Weet u zeker dat u dit lid wilt verwijderen?',
      demote: 'Degraderen',
      demoteToMember: 'Degraderen tot lid',
      disabled: 'Uitgeschakeld',
      editProfile: 'Profiel bewerken',
      enabled: 'Ingeschakeld',
      expires: 'Verloopt',
      filterConditions: 'Filter voorwaarden',
      filterName: 'Filter naam',
      filterViews: 'Filter weergaven',
      friday: 'Vrijdag',
      integration: 'Integratie',
      labels: 'Labels',
      language: 'Taal',
      logOut: 'Uitloggen',
      member: 'Lid',
      monday: 'Maandag',
      name: 'Naam',
      newPassword: 'Nieuw wachtwoord',
      noApiTokens: 'Geen API tokens',
      noApiTokensYet: 'Nog geen API tokens',
      noPermissions: 'Geen rechten',
      noPendingAgents: 'Geen wachtende agenten',
      noRegisteredAgents: 'Geen geregistreerde agenten',
      noSavedFilters: 'Geen opgeslagen filters',
      notifications: 'Meldingen',
      openSwaggerDocs: 'Open Swagger Docs',
      admin: 'Admin',
      adminOnly: 'Alleen admin',
      activate: 'Activeer',
      you: 'Jij',
      autoFamilyJoinHint: 'Nieuwe leden komen automatisch in deze familie.',
      deactivate: 'Deactiveer',
      firstAdmin: 'Eerste admin',
      makeAdmin: 'Maak admin',
      makeMember: 'Maak member',
      owner: 'Eigenaar',
      password: 'Wachtwoord',
      passwordMinLength: 'Wachtwoord moet minimaal {n} tekens bevatten',
      passwordMismatch: 'Wachtwoorden komen niet overeen',
      passwordRequired: 'Wachtwoord is verplicht',
      passwordSame: 'Nieuw wachtwoord moet anders zijn dan huidige',
      passwordUpdated: 'Wachtwoord succesvol bijgewerkt',
      pendingCount: 'In afwachting',
      profile: 'Profiel',
      profileSaveFailed: 'Profiel opslaan mislukt',
      reject: 'Afwijzen',
      rejectAgentConfirm: 'Weet u zeker dat u deze agent wilt afwijzen?',
      rejecting: 'Afwijzen...',
      requested: 'Aangevraagd',
      retentionDays: 'Bewaartermijn (dagen)',
      retentionPeriod: 'Bewaarperiode',
      revokeToken: 'Token intrekken',
      revokeTokenConfirm: 'Weet u zeker dat u dit token wilt intrekken?',
      revoking: 'Intrekken...',
      role: 'Rol',
      saturday: 'Zaterdag',
      saveProfile: 'Opslaan',
      selectDay: 'Selecteer dag',
      selectLanguage: 'Selecteer taal',
      shops: 'Winkels',
      sprintSettings: 'Sprint instellingen',
      sprintStartDay: 'Sprint startdag',
      sunday: 'Zondag',
      teamMembers: 'Teamleden',
      theme: 'Thema',
      thursday: 'Donderdag',
      title: 'Instellingen',
      tokenName: 'Token naam',
      tokenPermissions: 'Token rechten',
      tuesday: 'Dinsdag',
      unblock: 'Deblokkeren',
      unlimited: 'Onbeperkt',
      unnamed: 'Naamloos',
      update: 'Bijwerken',
      updateAvailable: 'Er is een nieuwe versie beschikbaar',
      updated: 'Bijgewerkt',
      version: 'Versie',
      wednesday: 'Woensdag',
      yourProfile: 'Jouw profiel',
    },
    projects: {
      title: 'Projecten',
      newProject: 'Nieuw project',
      createProject: 'Project aanmaken',
      projectName: 'Projectnaam',
      description: 'Beschrijving',
      color: 'Kleur',
      progress: 'Voortgang',
      tasksCompleted: 'taken voltooid',
      tasks: 'taken',
      subtasks: 'Sub-taken',
      noProjects: 'Nog geen projecten',
      noProjectsSub: 'Maak je eerste project om te beginnen',
      noTasks: 'Geen sub-taken in dit project',
      backToOverview: 'Terug naar overzicht',
      statusActive: 'Actief',
      statusCompleted: 'Voltooid',
      statusArchived: 'Gearchiveerd',
    },
    invite: {
      agentApiToken: '🔑 Agent API Token',
      agentInviteTitle: 'Agent Uitnodiging',
      agentLabel: 'Agent',
      agentTokenAutoGenerated: 'Er wordt automatisch een API-token gegenereerd voor deze agent-uitnodiging.',
      close: 'Sluiten',
      codeDeleted: 'Invite code verwijderd',
      copyToken: 'Kopieer token',
      copyUrl: 'Kopieer URL',
      delete: 'Verwijderen',
      expired: 'Verlopen',
      generate: 'Genereer Invite Code',
      generateAgent: 'Genereer Agent Uitnodiging',
      generateFailed: 'Genereren van uitnodigingscode mislukt',
      generateHuman: 'Genereer Menselijke Uitnodiging',
      generated: '{type} gegenereerd',
      generating: 'Bezig met genereren...',
      humanInviteTitle: 'Deel Menselijke Uitnodiging',
      humanLabel: 'Mens',
      inviteCode: 'Uitnodigingscode',
      inviteLink: 'Uitnodigingslink',
      minutesRemaining: 'Nog {n} minuten geldig',
      saveTokenWarning: 'Bewaar dit token nu — het wordt niet meer getoond. De agent blijft in afwachting totdat u goedkeurt.',
      share: 'Delen',
      shareFailed: 'Delen mislukt',
      shareInvite: 'Deel Invite',
      shareViaWhatsApp: 'Delen via WhatsApp',
      urlCopied: 'URL gekopieerd!',
      usedOn: 'Gebruikt op {date}',
    },
    calendar: {
      title: 'Kalender',
      newEvent: 'Nieuw event…',
      allDay: 'Hele dag',
      startTime: 'Starttijd',
      endTime: 'Eindtijd',
      description: 'Beschrijving',
      eventTitle: 'Evenement titel',
      saveEvent: 'Evenement opslaan',
      eventDescription: 'Evenement beschrijving',
      month: 'Maand',
      week: 'Week',
      day: 'Dag',
      agenda: 'Agenda',
      today: 'Vandaag',
      location: 'Locatie',
      repeat: 'Herhalen',
      noEvents: 'Geen agenda-items',
      datedTask: 'Taak',
      searchPlaceholder: 'Agenda zoeken...',
      viewLabel: 'Agendaweergave',
      previous: 'Vorige',
      next: 'Volgende',
      moreDetails: 'Meer details',
      fewerDetails: 'Minder details',
    },
    inbox: {
      title: 'Inbox',
      todo: 'Te doen',
      doneToday: 'Vandaag gedaan',
      blocked: 'Geblokkeerd',
      inboxIsEmpty: 'Inbox is leeg',
      selectAll: 'Alles selecteren',
      deselectAll: 'Alles deselecteren',
      cancelSelection: 'Selectie annuleren',
      pushSelected: 'Geselecteerde pushen',
      searchPlaceholder: 'Zoek in inbox...',
      noTasksFound: 'Geen taken gevonden',
      noResults: 'Geen resultaten',
      markAllDone: 'Alles als gedaan markeren',
      clearAll: 'Alles wissen',
      empty: 'Leeg',
    },
    members: {
      title: 'Leden',
      inviteMember: 'Lid uitnodigen',
      pendingInvites: 'Openstaande uitnodigingen',
      noMembers: 'Geen leden',
      role: 'Rol',
      manageMembers: 'Leden beheren',
      addMember: 'Lid toevoegen',
      familyLabel: 'Familie',
      sameFamilyHint: 'Hier zie je alleen leden uit dezelfde familie.',
    },
    agent: {
      title: 'Agenten',
      createToken: 'Token aanmaken',
      tokenCreated: 'Token succesvol aangemaakt',
      tokenRevoked: 'Token ingetrokken',
      tokenCopied: 'Token gekopieerd naar klembord',
      saveTokenNow: 'Bewaar dit token nu',
      pendingApproval: 'In afwachting van goedkeuring',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      noAgents: 'Geen agenten',
      agentName: 'Agent naam',
      agentEmail: 'Agent e-mail',
      permissions: 'Rechten',
      expiresAt: 'Verloopt op',
      revokeConfirm: 'Weet u zeker dat u dit token wilt intrekken?',
    },
  },
  de: {
    common: {
      add: 'Hinzufügen',
      addTooltip: 'Hinzufügen',
      archive: 'Archivieren',
      calendar: 'Kalender',
      cancel: 'Abbrechen',
      clearAllTooltip: 'Alles löschen',
      close: 'Schließen',
      closeEditor: 'Editor schließen',
      completed: 'Abgeschlossen',
      confirm: 'Bestätigen',
      confirmDeleteTitle: 'Möchtest du das wirklich löschen?',
      copied: 'Kopiert!',
      copiedToClipboard: 'In Zwischenablage kopiert',
      copyToClipboard: 'In Zwischenablage kopieren',
      create: 'Erstellen',
      daysLeft: '{n} Tage übrig',
      delete: 'Löschen',
      dueSoon: 'Demnächst fällig',
      edit: 'Bearbeiten',
      editTitle: 'Titel bearbeiten',
      error: 'Fehler',
      export: 'Exportieren',
      filter: 'Filtern',
      filters: 'Filter',
      filtersTooltip: 'Filter',
      hoursLeft: '{n} Stunden übrig',
      groceries: 'Einkäufe',
      import: 'Importieren',
      info: 'Info',
      inbox: 'Posteingang',
      items: 'Artikel',
      loading: 'Laden...',
      logout: 'Abmelden',
      markAsDone: 'Als erledigt markieren',
      markAsNotDone: 'Als nicht erledigt markieren',
      minutesLeft: '{n} Minuten übrig',
      no: 'Nein',
      noData: 'Keine Daten',
      notCompleted: 'Nicht abgeschlossen',
      notes: 'Notizen',
      openEditor: 'Editor öffnen',
      overdue: 'Überfällig',
      print: 'Drucken',
      refresh: 'Aktualisieren',
      restock: 'Auffüllen',
      remove: 'Entfernen',
      retry: 'Erneut versuchen',
      save: 'Speichern',
      search: 'Suchen',
      searchDot: 'Suchen...',
      searchTooltip: 'Suchen',
      settings: 'Einstellungen',
      share: 'Teilen',
      success: 'Erfolg',
      swapType: 'Typ wechseln',
      tasks: 'Aufgaben',
      typeHere: 'Hier tippen...',
      unknown: 'Unbekannt',
      warning: 'Warnung',
      yes: 'Ja',
    },
    onboarding: {
      accountCreationFailed: 'Kontoerstellung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      confirmPassword: 'Passwort bestätigen',
      createAccount: 'Konto erstellen',
      creatingAccount: 'Konto wird erstellt…',
      email: 'E-Mail',
      emailAlreadyInUse: 'Diese E-Mail wird bereits verwendet. Versuchen Sie sich anzumelden.',
      firstName: 'Vorname *',
      getStarted: 'Loslegen',
      goToLogin: 'Zum Login',
      lastName: 'Nachname',
      next: 'Weiter',
      password: 'Passwort',
      passwordDoesNotMeetRequirements: 'Passwort erfüllt nicht die Anforderungen: mindestens 8 Zeichen',
      passwordMinLength: 'Passwort muss mindestens 8 Zeichen lang sein',
      passwordsDoNotMatch: 'Passwörter stimmen nicht überein',
      pleaseConfirmPassword: 'Bitte bestätigen Sie Ihr Passwort',
      pleaseEnterEmail: 'Bitte geben Sie Ihre E-Mail ein',
      pleaseEnterFirstName: 'Bitte geben Sie Ihren Vornamen ein',
      pleaseEnterPassword: 'Bitte geben Sie ein Passwort ein',
      pleaseEnterWorkspaceName: 'Bitte geben Sie einen Arbeitsbereichsnamen ein',
      prefilledWithWorkspace: 'Vorausgefüllt mit Ihrem Arbeitsbereichsnamen, Sie können ihn ändern',
      skip: 'Überspringen',
      step1Desc: 'Ihr täglicher Assistent für schnelle, einfache Produktivität ohne Überforderung.',
      step2Desc: 'Verfolgen Sie Einkäufe mit Mengen und Geschäften. Halten Sie Ihre Einkaufsliste einfach und organisiert.',
      step2Title: 'Einfache Einkäufe',
      step3Desc: 'Geben Sie Ihrem Haushalt einen Namen. Dies ist die Hauptentität, die alle Mitglieder teilen.',
      step3Title: 'Arbeitsbereich Benennen',
      step4Desc: 'Richten Sie Ihr Administratorkonto ein, um loszulegen.',
      step4Title: 'Admin-Konto Erstellen',
      stepUserDesc: 'Bereit, Ihren Kopf zu leeren und organisiert zu werden?',
      stepUserTitle: 'Los Geht\'s',
      welcome: 'Willkommen bei todoless-ngx',
      workspaceName: 'Arbeitsbereichsname',
      workspaceNameMissing: 'Arbeitsbereichsname fehlt — gehen Sie zurück und geben Sie ihn ein',
    },
    tasks: {
      title: 'Aufgaben',
      newTask: 'Neue Aufgabe',
      dueDate: 'Fälligkeitsdatum',
      assignee: 'Zugewiesen an',
      labels: 'Etiketten',
      priority: 'Priorität',
      status: 'Status',
      completed: 'Abgeschlossen',
      inProgress: 'In Bearbeitung',
      todo: 'Zu erledigen',
      comment: 'Kommentar',
      focus: 'Fokus',
      commentPlaceholder: 'Kontext oder Blocker hinzufügen…',
      commentRequiredForFlag: 'Füge vor dem Markieren zuerst einen Kommentar hinzu.',
      addCommentAndFlag: 'Kommentar hinzufügen und markieren',
      subtasks: 'Teilaufgaben',
      subtaskAdded: 'Teilaufgabe hinzugefügt',
      failedToCreateSubtask: 'Teilaufgabe konnte nicht erstellt werden',
      newSubtaskTitle: 'Neuer Teilaufgaben-Titel',
      addSubtask: 'Teilaufgabe hinzufügen',
      markSubtaskAsDone: 'Teilaufgabe als erledigt markieren',
      markSubtaskAsNotDone: 'Teilaufgabe als nicht erledigt markieren',
      subtasksTooltip: 'Teilaufgaben',
      viewSubtasks: 'Teilaufgaben anzeigen',
    },
    items: {
      title: 'Artikel',
      newItem: 'Neuer Artikel',
      quantity: 'Menge',
      category: 'Kategorie',
      searchPlaceholder: 'Artikel suchen...',
      confirmDelete: 'Diesen Artikel löschen?',
      confirmRestock: 'Alle erledigten Einkäufe wieder auffüllen?',
      empty: 'Leer',
      restocked: 'Einkäufe wieder aufgefüllt',
      sortLabel: 'Sortieren',
      sortCategory: 'Nach Kategorie',
      sortCategoryAlpha: 'Kategorie A-Z',
      sortAlpha: 'A-Z',
    },
    notes: {
      title: 'Notizen',
      newNote: 'Neue Notiz',
      content: 'Inhalt',
    },
    filters: {
      title: 'Filter',
      noSavedFilters: 'Keine gespeicherten Filter',
      manageFilters: 'Verwalte deine gespeicherten Filter hier.',
    },
    groceries: {
      empty: 'Keine Artikel',
    },
    settings: {
      account: 'Konto',
      active: 'Aktiv',
      addFilter: 'Filter hinzufügen',
      addLabel: 'Etikett hinzufügen',
      addShop: 'Shop hinzufügen',
      addedBy: 'Hinzugefügt von',
      adminCountWarning: 'Warnung: Änderung der Admin-Anzahl',
      agentApproval: 'Agent-Genehmigung',
      agents: 'Agenten',
      apiDocumentation: 'API-Dokumentation',
      apiTokens: 'API-Tokens',
      appInfo: 'App-Info',
      approve: 'Genehmigen',
      approvedCount: 'Genehmigt',
      approving: 'Genehmige...',
      archiveSettings: 'Archiveinstellungen',
      autoCleanup: 'Automatische Bereinigung',
      blocked: 'Blockiert',
      cancelEdit: 'Abbrechen',
      changePassword: 'Passwort ändern',
      color: 'Farbe',
      commit: 'Commit',
      confirmPassword: 'Passwort bestätigen',
      copyAppInfo: 'Kopieren',
      copyFailed: 'Kopieren fehlgeschlagen',
      createApiToken: 'API-Token erstellen',
      created: 'Erstellt',
      currentPassword: 'Aktuelles Passwort',
      currentPasswordIncorrect: 'Aktuelles Passwort ist falsch',
      days30: '30 Tage',
      days60: '60 Tage',
      days90: '90 Tage',
      deleteMember: 'Mitglied löschen',
      deleteMemberConfirm: 'Sind Sie sicher, dass Sie dieses Mitglied löschen möchten?',
      demote: 'Herabstufen',
      demoteToMember: 'Zum Mitglied herabstufen',
      disabled: 'Deaktiviert',
      editProfile: 'Profil bearbeiten',
      enabled: 'Aktiviert',
      expires: 'Läuft ab',
      filterConditions: 'Filterbedingungen',
      filterName: 'Filtername',
      filterViews: 'Filteransichten',
      friday: 'Freitag',
      integration: 'Integration',
      labels: 'Etiketten',
      language: 'Sprache',
      logOut: 'Abmelden',
      member: 'Mitglied',
      monday: 'Montag',
      name: 'Name',
      newPassword: 'Neues Passwort',
      noApiTokens: 'Keine API-Tokens',
      noApiTokensYet: 'Noch keine API-Tokens',
      noPermissions: 'Keine Berechtigungen',
      noPendingAgents: 'Keine ausstehenden Agenten',
      noRegisteredAgents: 'Keine registrierten Agenten',
      noSavedFilters: 'Keine gespeicherten Filter',
      notifications: 'Benachrichtigungen',
      openSwaggerDocs: 'Swagger-Dokumentation öffnen',
      admin: 'Admin',
      adminOnly: 'Nur Admin',
      activate: 'Aktivieren',
      you: 'Du',
      autoFamilyJoinHint: 'Neue Mitglieder treten dieser Familie automatisch bei.',
      deactivate: 'Deaktivieren',
      firstAdmin: 'Erster Admin',
      makeAdmin: 'Zum Admin machen',
      makeMember: 'Zum Mitglied machen',
      owner: 'Besitzer',
      password: 'Passwort',
      passwordMinLength: 'Passwort muss mindestens {n} Zeichen lang sein',
      passwordMismatch: 'Passwörter stimmen nicht überein',
      passwordRequired: 'Passwort ist erforderlich',
      passwordSame: 'Neues Passwort muss sich vom aktuellen unterscheiden',
      passwordUpdated: 'Passwort erfolgreich aktualisiert',
      pendingCount: 'Ausstehend',
      profile: 'Profil',
      profileSaveFailed: 'Profil speichern fehlgeschlagen',
      reject: 'Ablehnen',
      rejectAgentConfirm: 'Sind Sie sicher, dass Sie diesen Agenten ablehnen möchten?',
      rejecting: 'Ablehnen...',
      requested: 'Angefordert',
      retentionDays: 'Aufbewahrungstage',
      retentionPeriod: 'Aufbewahrungsdauer',
      revokeToken: 'Token widerrufen',
      revokeTokenConfirm: 'Sind Sie sicher, dass Sie dieses Token widerrufen möchten?',
      revoking: 'Widerrufe...',
      role: 'Rolle',
      saturday: 'Samstag',
      saveProfile: 'Speichern',
      selectDay: 'Tag auswählen',
      selectLanguage: 'Sprache auswählen',
      shops: 'Geschäfte',
      sprintSettings: 'Sprint-Einstellungen',
      sprintStartDay: 'Sprint-Starttag',
      sunday: 'Sonntag',
      teamMembers: 'Teammitglieder',
      theme: 'Design',
      thursday: 'Donnerstag',
      title: 'Einstellungen',
      tokenName: 'Token-Name',
      tokenPermissions: 'Token-Berechtigungen',
      tuesday: 'Dienstag',
      unblock: 'Entsperren',
      unlimited: 'Unbegrenzt',
      unnamed: 'Unbenannt',
      update: 'Aktualisieren',
      updateAvailable: 'Eine neue Version ist verfügbar',
      updated: 'Aktualisiert',
      version: 'Version',
      wednesday: 'Mittwoch',
      yourProfile: 'Ihr Profil',
    },
    projects: {
      title: 'Projekte',
      newProject: 'Neues Projekt',
      createProject: 'Projekt erstellen',
      projectName: 'Projektname',
      description: 'Beschreibung',
      color: 'Farbe',
      progress: 'Fortschritt',
      tasksCompleted: 'Aufgaben abgeschlossen',
      tasks: 'Aufgaben',
      subtasks: 'Teilaufgaben',
      noProjects: 'Noch keine Projekte',
      noProjectsSub: 'Erstellen Sie Ihr erstes Projekt',
      noTasks: 'Keine Teilaufgaben in diesem Projekt',
      backToOverview: 'Zurück zur Übersicht',
      statusActive: 'Aktiv',
      statusCompleted: 'Abgeschlossen',
      statusArchived: 'Archiviert',
    },
    invite: {
      agentApiToken: '🔑 Agent API-Token',
      agentInviteTitle: 'Agent-Einladung',
      agentLabel: 'Agent',
      agentTokenAutoGenerated: 'Für diese Agent-Einladung wird automatisch ein API-Token generiert.',
      close: 'Schließen',
      codeDeleted: 'Einladungscode gelöscht',
      copyToken: 'Token kopieren',
      copyUrl: 'URL kopieren',
      delete: 'Löschen',
      expired: 'Abgelaufen',
      generate: 'Einladungscode generieren',
      generateAgent: 'Agent-Einladung generieren',
      generateFailed: 'Fehler beim Generieren des Einladungscodes',
      generateHuman: 'Menschliche Einladung generieren',
      generated: '{type} generiert',
      generating: 'Generiere...',
      humanInviteTitle: 'Menschliche Einladung teilen',
      humanLabel: 'Mensch',
      inviteCode: 'Einladungscode',
      inviteLink: 'Einladungslink',
      minutesRemaining: 'Noch {n} Minuten',
      saveTokenWarning: 'Speichern Sie dieses Token jetzt — es wird nicht wieder angezeigt. Der Agent bleibt in Wartestellung, bis Sie ihn genehmigen.',
      share: 'Teilen',
      shareFailed: 'Teilen fehlgeschlagen',
      shareInvite: 'Einladung teilen',
      shareViaWhatsApp: 'Über WhatsApp teilen',
      urlCopied: 'URL kopiert!',
      usedOn: 'Verwendet am {date}',
    },
    calendar: {
      title: 'Kalender',
      newEvent: 'Neues Ereignis…',
      allDay: 'Ganztägig',
      startTime: 'Startzeit',
      endTime: 'Endzeit',
      description: 'Beschreibung',
      eventTitle: 'Ereignistitel',
      saveEvent: 'Ereignis speichern',
      eventDescription: 'Ereignisbeschreibung',
      month: 'Monat',
      week: 'Woche',
      day: 'Tag',
      agenda: 'Agenda',
      today: 'Heute',
      location: 'Ort',
      repeat: 'Wiederholen',
      noEvents: 'Keine Kalendereinträge',
      datedTask: 'Aufgabe',
      searchPlaceholder: 'Kalender suchen...',
      viewLabel: 'Kalenderansicht',
      previous: 'Zurück',
      next: 'Weiter',
      moreDetails: 'Mehr Details',
      fewerDetails: 'Weniger Details',
    },
    inbox: {
      title: 'Posteingang',
      todo: 'Zu erledigen',
      doneToday: 'Heute erledigt',
      blocked: 'Blockiert',
      inboxIsEmpty: 'Posteingang ist leer',
      selectAll: 'Alle auswählen',
      deselectAll: 'Alle abwählen',
      cancelSelection: 'Auswahl aufheben',
      pushSelected: 'Ausgewählte verschieben',
      searchPlaceholder: 'Posteingang durchsuchen...',
      noTasksFound: 'Keine Aufgaben gefunden',
      noResults: 'Keine Ergebnisse',
      markAllDone: 'Alle als erledigt markieren',
      clearAll: 'Alles löschen',
      empty: 'Leer',
    },
    members: {
      title: 'Mitglieder',
      inviteMember: 'Mitglied einladen',
      pendingInvites: 'Ausstehende Einladungen',
      noMembers: 'Keine Mitglieder',
      role: 'Rolle',
      manageMembers: 'Mitglieder verwalten',
      addMember: 'Mitglied hinzufügen',
      familyLabel: 'Familie',
      sameFamilyHint: 'Hier werden nur Mitglieder derselben Familie angezeigt.',
    },
    agent: {
      title: 'Agenten',
      createToken: 'Token erstellen',
      tokenCreated: 'Token erfolgreich erstellt',
      tokenRevoked: 'Token widerrufen',
      tokenCopied: 'Token in Zwischenablage kopiert',
      saveTokenNow: 'Bitte speichern Sie dieses Token jetzt',
      pendingApproval: 'Ausstehende Genehmigung',
      approved: 'Genehmigt',
      rejected: 'Abgelehnt',
      noAgents: 'Keine Agenten',
      agentName: 'Agentenname',
      agentEmail: 'Agenten-E-Mail',
      permissions: 'Berechtigungen',
      expiresAt: 'Läuft ab am',
      revokeConfirm: 'Sind Sie sicher, dass Sie dieses Token widerrufen möchten?',
    },
  },
};


const overlayTranslations: Record<SupportedUiLanguage, Record<string, unknown>> = {
  "en": {
    "auth": {
      "appErrorDescription": "Something went wrong. Reset all data to continue.",
      "resetAllData": "Reset All Data & Restart"
    },
    "tasks": {
      "taskAdded": "Task added to inbox",
      "movedToBacklog": "Moved to backlog"
    },
    "common": {
      "previousSlide": "Previous slide",
      "nextSlide": "Next slide",
      "pagination": "pagination",
      "goToPreviousPage": "Go to previous page",
      "goToNextPage": "Go to next page",
      "toggleSidebar": "Toggle Sidebar",
      "sidebar": "Sidebar",
      "mobileSidebarDescription": "Displays the mobile sidebar.",
      "errorLoadingImage": "Error loading image"
    },
    "repeat": {
      "day": "Every day",
      "week": "Every week",
      "month": "Every month",
      "year": "Every year",
      "monthWeekdayFallback": "Every first Monday of the month",
      "monthly": "Monthly",
      "repeat": "Repeat",
      "shortDay": "Daily",
      "shortWeek": "Weekly",
      "shortMonth": "Monthly",
      "shortYear": "Yearly",
      "shortMonthPrefix": "Mon ·"
    }
  },
  "nl": {
    "auth": {
      "appErrorDescription": "Er is iets misgegaan. Reset alle data om door te gaan.",
      "resetAllData": "Alle data resetten & herstarten"
    },
    "tasks": {
      "taskAdded": "Taak toegevoegd aan inbox",
      "movedToBacklog": "Verplaatst naar backlog"
    },
    "common": {
      "previousSlide": "Vorige slide",
      "nextSlide": "Volgende slide",
      "pagination": "paginering",
      "goToPreviousPage": "Ga naar vorige pagina",
      "goToNextPage": "Ga naar volgende pagina",
      "toggleSidebar": "Sidebar wisselen",
      "sidebar": "Sidebar",
      "mobileSidebarDescription": "Toont de mobiele sidebar.",
      "errorLoadingImage": "Afbeelding laden mislukt"
    },
    "repeat": {
      "day": "Elke dag",
      "week": "Elke week",
      "month": "Elke maand",
      "year": "Elk jaar",
      "monthWeekdayFallback": "Elke eerste maandag van de maand",
      "monthly": "Maandelijks",
      "repeat": "Herhalen",
      "shortDay": "Dagelijks",
      "shortWeek": "Wekelijks",
      "shortMonth": "Maandelijks",
      "shortYear": "Jaarlijks",
      "shortMonthPrefix": "Mnd ·"
    }
  },
  "fr": {
    "auth": {
      "appErrorDescription": "Une erreur est survenue. Réinitialisez toutes les données pour continuer.",
      "resetAllData": "Réinitialiser toutes les données et redémarrer"
    },
    "tasks": {
      "taskAdded": "Tâche ajoutée à l’inbox",
      "movedToBacklog": "Déplacé vers le backlog"
    },
    "common": {
      "previousSlide": "Diapositive précédente",
      "nextSlide": "Diapositive suivante",
      "pagination": "pagination",
      "goToPreviousPage": "Aller à la page précédente",
      "goToNextPage": "Aller à la page suivante",
      "toggleSidebar": "Basculer la barre latérale",
      "sidebar": "Barre latérale",
      "mobileSidebarDescription": "Affiche la barre latérale mobile.",
      "errorLoadingImage": "Erreur de chargement de l’image"
    },
    "repeat": {
      "day": "Chaque jour",
      "week": "Chaque semaine",
      "month": "Chaque mois",
      "year": "Chaque année",
      "monthWeekdayFallback": "Chaque premier lundi du mois",
      "monthly": "Mensuel",
      "repeat": "Répéter",
      "shortDay": "Quotidien",
      "shortWeek": "Hebdomadaire",
      "shortMonth": "Mensuel",
      "shortYear": "Annuel",
      "shortMonthPrefix": "Mois ·"
    }
  }
};

const extraTranslations: Record<SupportedUiLanguage, Record<string, unknown>> = {
  "en": {
    "auth": {
      "appError": "App Error",
      "welcomeBack": "Welcome back",
      "signInSubtitle": "Sign in to your todoless-ngx account",
      "email": "Email",
      "password": "Password",
      "logIn": "Log In",
      "missingCredentials": "Please enter email and password",
      "invalidCredentials": "Invalid email or password",
      "noAccountInviteHint": "Don't have an account? Contact your administrator for an invite.",
      "iHaveInviteCode": "I have an invite code",
      "joinTitle": "Join todoless-ngx",
      "invitePrompt": "Enter your 6-digit invite code to get started",
      "inviteCode": "Invite Code",
      "validateCode": "Validate Code",
      "alreadyHaveAccount": "Already have an account?",
      "loginLink": "Log in",
      "invalidInviteCode": "Please enter a valid invite code",
      "expiredInviteCode": "Invalid or expired invite code",
      "inviteValidated": "Invite code validated!",
      "createAccountTitle": "Create Your Account",
      "createAccountSubtitle": "Set up your profile to start organizing",
      "firstName": "First Name",
      "lastName": "Last Name",
      "emailInvalid": "Please enter a valid email address",
      "firstNameRequired": "First name is required",
      "allFieldsRequired": "All fields are required",
      "passwordMinLength": "Password must be at least 6 characters",
      "passwordMinLengthShort": "Minimum 6 characters",
      "passwordsDoNotMatch": "Passwords do not match",
      "confirmPassword": "Confirm Password",
      "registrationFailed": "Registration failed",
      "createAccount": "Create Account"
    },
    "onboarding": {
      "exampleFamilyName": "Smith Family"
    },
    "filters": {
      "deleted": "Filter deleted",
      "saved": "Filter saved",
      "saveFailed": "Failed to save filter",
      "saveUnavailable": "Filter saved (not yet implemented)",
      "taskOrShopPrompt": "Task or shop?",
      "itemOrShopPrompt": "Item or shop?",
      "sortTasks": "Sort tasks",
      "priority": "Priority",
      "dueDate": "Due date",
      "savedFilters": "Saved Filters",
      "deleteFilter": "Delete filter",
      "filterByLabel": "Filter by Label",
      "editLabel": "Edit label",
      "deleteLabel": "Delete label",
      "labelNamePlaceholder": "Label name...",
      "filterByAssignee": "Filter by Assignee",
      "newFilterNamePlaceholder": "New filter name...",
      "newLabel": "New label",
      "saveJqlHint": "Saves current JQL query and label filters",
      "saveLabelsHint": "Select labels above, then save as filter",
      "noSavedFiltersHint": "No saved filters. Apply filters via chips and save them here.",
      "applied": "Filter applied",
      "noActiveFilters": "No active filters to save"
    },
    "settings": {
      "adminUpdated": "Admin updated",
      "memberUpdated": "Member updated",
      "memberUnblocked": "Member unblocked",
      "memberBlocked": "Member blocked",
      "roleUpdated": "Role updated",
      "memberDeleted": "Member deleted",
      "addLabelTitle": "Add Label",
      "editLabelTitle": "Edit Label",
      "addShopTitle": "Add Shop",
      "editShopTitle": "Edit Shop",
      "labelNamePlaceholder": "Label Name",
      "shopNamePlaceholder": "Shop Name"
    },
    "tasks": {
      "linkedUnder": "Linked under \"{title}\"",
      "noMatchingParentTask": "No matching main task found",
      "subtasksEditTitle": "Edit subtasks",
      "subtasksEditAria": "Edit subtasks",
      "subtaskTitleEditAria": "Edit subtask title",
      "subtaskEditTitle": "Edit subtask",
      "subtaskDeleteTitle": "Delete subtask",
      "editPriority": "Edit priority",
      "toggleFocus": "Toggle focus",
      "otherActions": "Other actions",
      "swap": "Swap",
      "promotedStandalone": "Promoted to standalone task",
      "makeMainTask": "Make main task again",
      "makeSubTask": "Make sub-task",
      "parentTaskSearchPlaceholder": "Type to search for a parent task",
      "inbox": "Inbox"
    },
    "groceries": {
      "categories": {
        "produce": "🥔 Potatoes, Vegetables & Fruit",
        "freshMeals": "🥗 Fresh Meals & Convenience",
        "meatFishVega": "🥩 Meat, Fish & Vegetarian",
        "breadPastry": "🍞 Bread & Pastry",
        "dairyButterEggs": "🥛 Dairy, Butter & Eggs",
        "deliCheeseTapas": "🧀 Cold Cuts, Cheese & Tapas",
        "cansSoupsSaucesOil": "🥫 Cans, Soups, Sauces & Oil",
        "worldHerbsPastaRice": "🌍 World Foods, Herbs, Pasta & Rice",
        "breakfastSpreadsBaking": "🥣 Breakfast, Spreads & Baking",
        "cookiesCandyChocolateChips": "🍪 Cookies, Candy, Chocolate & Chips",
        "coffeeTea": "☕ Coffee & Tea",
        "softDrinksJuices": "🥤 Soft Drinks & Juices",
        "beerWine": "🍷 Beer & Wine",
        "frozen": "❄️ Frozen",
        "drugstoreHealth": "💊 Drugstore & Health",
        "babyChild": "👶 Baby & Child",
        "householdPets": "🧼 Household & Pets",
        "nonFoodService": "🧾 Non-food & Service Desk",
        "other": "Other"
      }
    },
    "invite": {
      "generatedHuman": "Member invite generated",
      "generateMember": "Generate member invite",
      "memberInviteTitle": "Share member invite",
      "memberLabel": "Member",
      "shareTitle": "Invite to todoless-ngx",
      "shareText": "Member invite to todoless-ngx\n\nCode: {code}\n\n{url}",
      "copyText": "{url}\n\nCode: {code}"
    },
    "common": {
      "previous": "Previous",
      "next": "Next",
      "more": "More",
      "morePages": "More pages"
    }
  },
  "nl": {
    "auth": {
      "appError": "App-fout",
      "welcomeBack": "Welkom terug",
      "signInSubtitle": "Log in op je todoless-ngx account",
      "email": "E-mail",
      "password": "Wachtwoord",
      "logIn": "Inloggen",
      "missingCredentials": "Vul e-mail en wachtwoord in",
      "invalidCredentials": "Ongeldige e-mail of wachtwoord",
      "noAccountInviteHint": "Nog geen account? Vraag je beheerder om een uitnodiging.",
      "iHaveInviteCode": "Ik heb een invite-code",
      "joinTitle": "Word lid van todoless-ngx",
      "invitePrompt": "Voer je 6-cijferige invite-code in om te starten",
      "inviteCode": "Invite-code",
      "validateCode": "Code valideren",
      "alreadyHaveAccount": "Heb je al een account?",
      "loginLink": "Inloggen",
      "invalidInviteCode": "Voer een geldige invite-code in",
      "expiredInviteCode": "Ongeldige of verlopen invite-code",
      "inviteValidated": "Invite-code gevalideerd!",
      "createAccountTitle": "Maak je account aan",
      "createAccountSubtitle": "Stel je profiel in om te starten met organiseren",
      "firstName": "Voornaam",
      "lastName": "Achternaam",
      "emailInvalid": "Voer een geldig e-mailadres in",
      "firstNameRequired": "Voornaam is verplicht",
      "allFieldsRequired": "Alle velden zijn verplicht",
      "passwordMinLength": "Wachtwoord moet minimaal 6 tekens zijn",
      "passwordMinLengthShort": "Minimaal 6 tekens",
      "passwordsDoNotMatch": "Wachtwoorden komen niet overeen",
      "confirmPassword": "Bevestig wachtwoord",
      "registrationFailed": "Registratie mislukt",
      "createAccount": "Account aanmaken"
    },
    "onboarding": {
      "exampleFamilyName": "Familie Jansen"
    },
    "filters": {
      "deleted": "Filter verwijderd",
      "saved": "Filter opgeslagen",
      "saveFailed": "Filter opslaan mislukt",
      "saveUnavailable": "Filter opgeslagen (nog niet geïmplementeerd)",
      "taskOrShopPrompt": "Taak of winkel?",
      "itemOrShopPrompt": "Item of winkel?",
      "sortTasks": "Taken sorteren",
      "priority": "Prioriteit",
      "dueDate": "Vervaldatum",
      "savedFilters": "Opgeslagen filters",
      "deleteFilter": "Filter verwijderen",
      "filterByLabel": "Filter op label",
      "editLabel": "Label bewerken",
      "deleteLabel": "Label verwijderen",
      "labelNamePlaceholder": "Labelnaam...",
      "filterByAssignee": "Filter op toegewezen persoon",
      "newFilterNamePlaceholder": "Nieuwe filternaam...",
      "newLabel": "Nieuw label",
      "saveJqlHint": "Slaat de huidige JQL-query en labelfilters op",
      "saveLabelsHint": "Selecteer hierboven labels en sla ze op als filter",
      "noSavedFiltersHint": "Geen opgeslagen filters. Pas filters toe via chips en sla ze hier op.",
      "applied": "Filter toegepast",
      "noActiveFilters": "Geen actieve filters om op te slaan"
    },
    "settings": {
      "adminUpdated": "Admin bijgewerkt",
      "memberUpdated": "Member bijgewerkt",
      "memberUnblocked": "Member gedeblokkeerd",
      "memberBlocked": "Member geblokkeerd",
      "roleUpdated": "Rol bijgewerkt",
      "memberDeleted": "Member verwijderd",
      "addLabelTitle": "Label toevoegen",
      "editLabelTitle": "Label bewerken",
      "addShopTitle": "Winkel toevoegen",
      "editShopTitle": "Winkel bewerken",
      "labelNamePlaceholder": "Labelnaam",
      "shopNamePlaceholder": "Winkelnaam"
    },
    "tasks": {
      "linkedUnder": "Gekoppeld onder \"{title}\"",
      "noMatchingParentTask": "Geen passende hoofdtaak gevonden",
      "subtasksEditTitle": "Subtaken bewerken",
      "subtasksEditAria": "Subtaken bewerken",
      "subtaskTitleEditAria": "Subtaaktitel bewerken",
      "subtaskEditTitle": "Subtaak bewerken",
      "subtaskDeleteTitle": "Subtaak verwijderen",
      "editPriority": "Prioriteit bewerken",
      "toggleFocus": "Focus wisselen",
      "otherActions": "Andere acties",
      "swap": "Wisselen",
      "promotedStandalone": "Gepromoveerd naar losse taak",
      "makeMainTask": "Maak weer hoofdtaak",
      "makeSubTask": "Maak sub-taak",
      "parentTaskSearchPlaceholder": "Typ om een hoofdtaak te zoeken",
      "inbox": "Inbox"
    },
    "groceries": {
      "categories": {
        "produce": "🥔 Aardappelen, Groente & Fruit",
        "freshMeals": "🥗 Verse Maaltijden & Gemak",
        "meatFishVega": "🥩 Vlees, Vis & Vega",
        "breadPastry": "🍞 Brood & Gebak",
        "dairyButterEggs": "🥛 Zuivel, Boter & Eieren",
        "deliCheeseTapas": "🧀 Vleeswaren, Kaas & Tapas",
        "cansSoupsSaucesOil": "🥫 Conserven, Soepen, Sauzen & Olie",
        "worldHerbsPastaRice": "🌍 Wereldkeukens, Kruiden, Pasta & Rijst",
        "breakfastSpreadsBaking": "🥣 Ontbijt, Broodbeleg & Bakproducten",
        "cookiesCandyChocolateChips": "🍪 Koek, Snoep, Chocolade & Chips",
        "coffeeTea": "☕ Koffie & Thee",
        "softDrinksJuices": "🥤 Frisdrank & Sappen",
        "beerWine": "🍷 Bier & Wijn",
        "frozen": "❄️ Diepvries",
        "drugstoreHealth": "💊 Drogisterij & Gezondheid",
        "babyChild": "👶 Baby & Kind",
        "householdPets": "🧼 Huishouden & Dieren",
        "nonFoodService": "🧾 Non-food & Servicebalie",
        "other": "Overig"
      }
    },
    "invite": {
      "generatedHuman": "Uitnodiging voor lid gegenereerd",
      "generateMember": "Genereer uitnodiging voor lid",
      "memberInviteTitle": "Deel uitnodiging voor lid",
      "memberLabel": "Lid",
      "shareTitle": "Uitnodiging voor todoless-ngx",
      "shareText": "Uitnodiging voor lid voor todoless-ngx\n\nCode: {code}\n\n{url}",
      "copyText": "{url}\n\nCode: {code}"
    },
    "common": {
      "previous": "Vorige",
      "next": "Volgende",
      "more": "Meer",
      "morePages": "Meer pagina’s"
    }
  },
  "fr": {
    "auth": {
      "appError": "Erreur de l’application",
      "welcomeBack": "Bon retour",
      "signInSubtitle": "Connectez-vous à votre compte todoless-ngx",
      "email": "E-mail",
      "password": "Mot de passe",
      "logIn": "Connexion",
      "missingCredentials": "Veuillez saisir votre e-mail et votre mot de passe",
      "invalidCredentials": "E-mail ou mot de passe invalide",
      "noAccountInviteHint": "Pas encore de compte ? Demandez une invitation à votre administrateur.",
      "iHaveInviteCode": "J’ai un code d’invitation",
      "joinTitle": "Rejoindre todoless-ngx",
      "invitePrompt": "Saisissez votre code d’invitation à 6 caractères pour commencer",
      "inviteCode": "Code d’invitation",
      "validateCode": "Valider le code",
      "alreadyHaveAccount": "Vous avez déjà un compte ?",
      "loginLink": "Connexion",
      "invalidInviteCode": "Veuillez saisir un code d’invitation valide",
      "expiredInviteCode": "Code d’invitation invalide ou expiré",
      "inviteValidated": "Code d’invitation validé !",
      "createAccountTitle": "Créer votre compte",
      "createAccountSubtitle": "Configurez votre profil pour commencer à organiser",
      "firstName": "Prénom",
      "lastName": "Nom",
      "emailInvalid": "Veuillez saisir une adresse e-mail valide",
      "firstNameRequired": "Le prénom est obligatoire",
      "allFieldsRequired": "Tous les champs sont obligatoires",
      "passwordMinLength": "Le mot de passe doit contenir au moins 6 caractères",
      "passwordMinLengthShort": "Minimum 6 caractères",
      "passwordsDoNotMatch": "Les mots de passe ne correspondent pas",
      "confirmPassword": "Confirmer le mot de passe",
      "registrationFailed": "Inscription échouée",
      "createAccount": "Créer le compte"
    },
    "onboarding": {
      "exampleFamilyName": "Famille Dupont"
    },
    "filters": {
      "deleted": "Filtre supprimé",
      "saved": "Filtre enregistré",
      "saveFailed": "Échec de l’enregistrement du filtre",
      "saveUnavailable": "Filtre enregistré (pas encore implémenté)",
      "taskOrShopPrompt": "Tâche ou magasin ?",
      "itemOrShopPrompt": "Article ou magasin ?",
      "sortTasks": "Trier les tâches",
      "priority": "Priorité",
      "dueDate": "Échéance",
      "savedFilters": "Filtres enregistrés",
      "deleteFilter": "Supprimer le filtre",
      "filterByLabel": "Filtrer par label",
      "editLabel": "Modifier le label",
      "deleteLabel": "Supprimer le label",
      "labelNamePlaceholder": "Nom du label...",
      "filterByAssignee": "Filtrer par assigné",
      "newFilterNamePlaceholder": "Nouveau nom de filtre...",
      "newLabel": "Nouveau label",
      "saveJqlHint": "Enregistre la requête JQL actuelle et les filtres de labels",
      "saveLabelsHint": "Sélectionnez des labels ci-dessus, puis enregistrez comme filtre",
      "noSavedFiltersHint": "Aucun filtre enregistré. Appliquez des filtres via les chips et enregistrez-les ici.",
      "applied": "Filtre appliqué",
      "noActiveFilters": "Aucun filtre actif à enregistrer"
    },
    "settings": {
      "adminUpdated": "Admin mis à jour",
      "memberUpdated": "Membre mis à jour",
      "memberUnblocked": "Membre débloqué",
      "memberBlocked": "Membre bloqué",
      "roleUpdated": "Rôle mis à jour",
      "memberDeleted": "Membre supprimé",
      "addLabelTitle": "Ajouter une étiquette",
      "editLabelTitle": "Modifier l’étiquette",
      "addShopTitle": "Ajouter un magasin",
      "editShopTitle": "Modifier le magasin",
      "labelNamePlaceholder": "Nom de l’étiquette",
      "shopNamePlaceholder": "Nom du magasin"
    },
    "tasks": {
      "linkedUnder": "Lié sous « {title} »",
      "noMatchingParentTask": "Aucune tâche principale correspondante trouvée",
      "subtasksEditTitle": "Modifier les sous-tâches",
      "subtasksEditAria": "Modifier les sous-tâches",
      "subtaskTitleEditAria": "Modifier le titre de la sous-tâche",
      "subtaskEditTitle": "Modifier la sous-tâche",
      "subtaskDeleteTitle": "Supprimer la sous-tâche",
      "editPriority": "Modifier la priorité",
      "toggleFocus": "Basculer le focus",
      "otherActions": "Autres actions",
      "swap": "Échanger",
      "promotedStandalone": "Promu en tâche autonome",
      "makeMainTask": "Redevenir tâche principale",
      "makeSubTask": "Créer une sous-tâche",
      "parentTaskSearchPlaceholder": "Tapez pour rechercher une tâche parent",
      "inbox": "Inbox"
    },
    "groceries": {
      "categories": {
        "produce": "🥔 Pommes de terre, légumes et fruits",
        "freshMeals": "🥗 Repas frais & prêt-à-manger",
        "meatFishVega": "🥩 Viande, poisson & végétarien",
        "breadPastry": "🍞 Pain & pâtisserie",
        "dairyButterEggs": "🥛 Produits laitiers, beurre & œufs",
        "deliCheeseTapas": "🧀 Charcuterie, fromage & tapas",
        "cansSoupsSaucesOil": "🥫 Conserves, soupes, sauces & huile",
        "worldHerbsPastaRice": "🌍 Cuisine du monde, épices, pâtes & riz",
        "breakfastSpreadsBaking": "🥣 Petit-déjeuner, tartinables & pâtisserie",
        "cookiesCandyChocolateChips": "🍪 Biscuits, bonbons, chocolat & chips",
        "coffeeTea": "☕ Café & thé",
        "softDrinksJuices": "🥤 Sodas & jus",
        "beerWine": "🍷 Bière & vin",
        "frozen": "❄️ Surgelés",
        "drugstoreHealth": "💊 Droguerie & santé",
        "babyChild": "👶 Bébé & enfant",
        "householdPets": "🧼 Maison & animaux",
        "nonFoodService": "🧾 Non-alimentaire & service",
        "other": "Autre"
      }
    },
    "invite": {
      "generatedHuman": "Invitation membre générée",
      "generateMember": "Générer une invitation membre",
      "memberInviteTitle": "Partager l’invitation membre",
      "memberLabel": "Membre",
      "shareTitle": "Invitation à todoless-ngx",
      "shareText": "Invitation membre à todoless-ngx\n\nCode : {code}\n\n{url}",
      "copyText": "{url}\n\nCode : {code}"
    },
    "common": {
      "previous": "Précédent",
      "next": "Suivant",
      "more": "Plus",
      "morePages": "Plus de pages"
    }
  }
};

function lookupNested(dict: unknown, key: string): string | undefined {
  const parts = key.split('.');
  let value: any = dict;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
}

/** Simple translation helper: looks up nested key in language dict. */
function lookupTranslation(key: string, lang: Language): string | undefined {
  const overlayDict = isSupportedUiLanguage(lang) ? overlayTranslations[lang] : undefined;
  const overlay = lookupNested(overlayDict, key);
  if (overlay) return overlay;
  const extraDict = isSupportedUiLanguage(lang) ? extraTranslations[lang] : undefined;
  const extra = lookupNested(extraDict, key);
  if (extra) return extra;
  const dict = translations[lang];
  const parts = key.split('.');
  let value: any = dict;
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
}

/** Simple translation helper: active language → English fallback → key. */
export function t(key: string, lang: Language = activeLanguage): string {
  return lookupTranslation(key, lang) ?? lookupTranslation(key, 'en') ?? key;
}

export function formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions, lang: Language = activeLanguage): string {
  return new Intl.DateTimeFormat(lang, options).format(new Date(value));
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, lang: Language = activeLanguage): string {
  return new Intl.NumberFormat(lang, options).format(value);
}
