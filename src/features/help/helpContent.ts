import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Bot, Clock, Columns3, FolderPlus, Home, Keyboard, LayoutTemplate, LifeBuoy,
  ListChecks, Paperclip, Rocket, Settings, SlidersHorizontal, SquarePen, Activity, Users, Workflow, Zap,
} from 'lucide-react';

/**
 * In-app help. Text supports **bold** for button and menu names.
 * Each topic is either numbered steps, bullet points, or a short paragraph (or a mix).
 */
export interface HelpTopic {
  heading: string;
  text?: string;
  steps?: string[];
  bullets?: string[];
  tip?: string;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  topics: HelpTopic[];
}

export interface HelpGroup {
  title: string;
  sections: HelpSection[];
}

export const HELP: HelpGroup[] = [
  {
    title: 'Getting started',
    sections: [
      {
        id: 'getting-started',
        title: 'Getting started',
        icon: Rocket,
        summary: 'The five-minute tour: from an empty workspace to a working board.',
        topics: [
          {
            heading: 'Your first project in five steps',
            steps: [
              'In the sidebar, click **New project** (or the **+** next to **Shared projects**).',
              'Pick a template under **Start from** (for example Software sprint or Marketing), or keep **Blank**. Give it a **Name** and click **Create project**.',
              'Click **People** at the top of the project and add your teammates.',
              'Type a card name in **Add a card to To do, press Enter** and press Enter. Repeat for a few cards.',
              'Drag cards between columns as work moves along. When a card reaches a column marked Done it counts as completed.',
            ],
            tip: 'In a hurry? Press **Ctrl + K** and type "Add these cards:" followed by a list. The AI assistant creates them all at once.',
          },
          {
            heading: 'Who can do what',
            bullets: [
              '**Governor**: super admin. Sees every project, creates and deletes projects, manages people and access.',
              '**Delegate**: project manager. Creates projects and runs them. Sees other projects only when a governor gives access.',
              '**Reporter**: read only. Views the projects they are given, for reporting.',
              'Inside a project, each person is **Read only**, **Read & write**, or **Read, write & delete own**. The person who created a project is its **Project lead**.',
            ],
          },
        ],
      },
      {
        id: 'navigation',
        title: 'Finding your way around',
        icon: Home,
        summary: 'Sidebar, Home, My tasks, search and the theme switch.',
        topics: [
          {
            heading: 'The sidebar',
            bullets: [
              '**Home**: your dashboard: what needs attention, project progress and health, and workload by person.',
              '**My tasks**: every card assigned to you across all projects, grouped by Overdue, Today, Next 7 days, Later and No due date.',
              '**Reports**: daily, weekly and monthly reports you can print or download.',
              '**AI assistant**: add or move cards by typing plain English.',
              '**My space**: a private project only you can see, handy for personal to-dos.',
              '**Shared projects**: the projects you belong to. Archived projects are tucked under **Archived** at the bottom of the list.',
              '**Help**, **Shortcuts** and **Settings** live at the bottom of the sidebar.',
            ],
          },
          {
            heading: 'Search',
            steps: [
              'Click the search box at the top of the screen, or press **/**.',
              'Type part of a card or project name.',
              'Click a result to jump straight to it. Cards open in their side panel.',
            ],
          },
          {
            heading: 'Light and dark mode',
            text: 'Use the sun/moon switch at the top right, or press **T**. To follow your computer\'s setting instead, go to **Settings → App & theme** and pick **System**.',
          },
          {
            heading: 'On a phone',
            text: 'Tap the menu button at the top left to open the sidebar. Every feature works on a phone. Some project buttons (Fields, Automations) move into the **⋯** menu on small screens.',
          },
        ],
      },
    ],
  },
  {
    title: 'Projects',
    sections: [
      {
        id: 'projects',
        title: 'Create and manage projects',
        icon: FolderPlus,
        summary: 'Create, edit, archive and delete projects.',
        topics: [
          {
            heading: 'Create a project',
            steps: [
              'In the sidebar, click **New project**.',
              'Under **Start from**, choose **Blank** or a template. The preview shows the **Columns**, **Fields** and **Starter cards** you will get.',
              'Enter a **Name**, an optional **Description**, and pick a **Color**.',
              'Click **Create project** (or **Create from template**).',
            ],
          },
          {
            heading: 'Edit, archive or delete',
            steps: [
              'Open the project and click the **⋯** button at the top right.',
              'Choose **Edit details** to rename it or change its color or description.',
              'Choose **Archive** to hide a finished project. Nothing is deleted. It moves under **Archived** at the bottom of the sidebar, and **Restore** brings it back.',
              'Choose **Delete project** to remove it and all of its cards for good. Only governors can do this.',
            ],
            tip: 'Archive instead of deleting when you might want the history later. Archived projects are read only.',
          },
        ],
      },
      {
        id: 'people',
        title: 'People and access',
        icon: Users,
        summary: 'Add teammates to a project and choose what they can do.',
        topics: [
          {
            heading: 'Add someone to a project',
            steps: [
              'Open the project and click **People** (or **⋯ → Manage people**).',
              'Under **Add someone**, pick a person from **Choose a person...**.',
              'Choose their access: **Read only**, **Read & write**, or **Read, write & delete own**.',
              'Click **Add**. They see the project in their sidebar right away.',
            ],
          },
          {
            heading: 'Change or remove access',
            text: 'In the same **People** window, change the access level next to a name, or click the remove button to take them off the project. Governors always have full control and are listed separately under **Governors**.',
          },
          {
            heading: 'Add new users to the workspace',
            text: 'Governors add accounts in **Settings → Users**. There you can also change someone\'s role (Governor, Delegate, Reporter), disable an account, and see which projects a person can reach.',
          },
        ],
      },
      {
        id: 'workflow',
        title: 'Update the workflow (columns)',
        icon: Workflow,
        summary: 'Add, rename, recolor, reorder and remove the columns cards move through.',
        topics: [
          {
            heading: 'Open the workflow editor',
            steps: [
              'Open the project.',
              'Click **Workflow** at the top right (or **⋯ → Manage workflow**).',
            ],
          },
          {
            heading: 'Add a column',
            steps: [
              'At the bottom of the Workflow window, type a name in **New status name** (for example "Blocked" or "QA").',
              'Click **Add**. The new column appears at the end of the board.',
            ],
          },
          {
            heading: 'Rename, recolor or reorder',
            steps: [
              'To rename, click the column name, type the new name and press Enter.',
              'To change its color, click the colored dot and pick a color.',
              'To reorder, drag the handle (⋮⋮) on the left of a row up or down. The board follows the same order.',
            ],
          },
          {
            heading: 'Mark a column as "Done"',
            text: 'Click **Done** on a row to make it a finishing column. Cards moved there count as completed: they get a completion date, stop showing as overdue, and count toward progress and reports. You can have more than one Done column (for example "Released" and "Won\'t do").',
          },
          {
            heading: 'Delete a column',
            steps: [
              'Click the bin icon on the row.',
              'If the column still has cards, choose where they go under **Move tasks to**.',
              'Confirm. The cards move first, then the column is removed.',
            ],
          },
          {
            heading: 'Finish',
            text: 'Click **Done** at the bottom of the window. Changes are saved as you make them and everyone on the project sees them at once.',
            tip: 'Automations that move cards to a column you deleted stop doing that step. Check **Automations** after big workflow changes.',
          },
        ],
      },
      {
        id: 'fields',
        title: 'Custom fields',
        icon: SlidersHorizontal,
        summary: 'Track extra details such as story points, client name or epic.',
        topics: [
          {
            heading: 'Add a field',
            steps: [
              'Open the project and click **Fields** (or **⋯ → Custom fields**).',
              'Click **Add a field** and give it a **Field name** (for example "Story points").',
              'Pick a **Type**: **Text**, **Number**, **Date**, **Dropdown** (one of a few choices) or **Checkbox** (yes or no).',
              'For a Dropdown, type the **Choices** (click **Add choice** for more) and click each dot to give it a color.',
              'Leave the show-on-card box ticked to display the value on board cards. You can switch this later with the eye icon next to the field.',
              'Save. The field now appears in every card\'s **Details** tab under **Fields**.',
            ],
            tip: 'A field\'s type can\'t change once it exists. Delete it and add a new one if you picked the wrong type.',
          },
          {
            heading: 'Fill in a field',
            text: 'Open a card. In **Details → Fields**, type or pick the value. It saves when you click away. You can also filter and sort by fields in **List** view.',
          },
        ],
      },
      {
        id: 'templates',
        title: 'Project templates',
        icon: LayoutTemplate,
        summary: 'Start new projects from a ready-made setup, or save your own.',
        topics: [
          {
            heading: 'Use a template',
            text: 'When you create a project, pick a template under **Start from**. You get its columns, custom fields and starter cards.',
          },
          {
            heading: 'Save a project as a template',
            steps: [
              'Open a project whose setup you like.',
              'Click **⋯ → Save as template**.',
              'Enter a **Template name** and a short **Description** (when to use it).',
              'Tick **Include the … cards** to keep the current cards as starter cards (titles, descriptions, priorities, checklists and field values; assignees, dates and comments are left out). Click **Save template**.',
              'It now appears under **Start from** for everyone in the workspace.',
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Cards',
    sections: [
      {
        id: 'create-cards',
        title: 'Create cards (tasks)',
        icon: SquarePen,
        summary: 'Five ways to add a card.',
        topics: [
          {
            heading: '1. Quick add (fastest)',
            steps: [
              'Open a project in **Board** or **List** view.',
              'Click the **Add a card to To do, press Enter** box at the top (or press **N**).',
              'Type the card name and press **Enter**. Keep typing to add more. Press **Esc** when done.',
            ],
          },
          {
            heading: '2. Straight into a column',
            text: 'On the board, click the **+** at the top of any column to add a card directly to that column.',
          },
          {
            heading: '3. On a date',
            text: 'In **Calendar** view, click a day and add the card there. It gets that day as its due date.',
          },
          {
            heading: '4. With the AI assistant',
            text: 'Press **Ctrl + K** and type, for example, "Add a card to fix the login bug, high priority, due Friday, assign to me". See **AI assistant** below.',
          },
          {
            heading: '5. Copy an existing card',
            text: 'Open a card and click the **Duplicate** icon at the top of the panel. You get a copy with the same details and checklist.',
          },
          {
            heading: 'After adding',
            text: 'Click the card to open its panel and fill in the assignee, priority, dates, description and checklist. See **Work on a card**.',
          },
        ],
      },
      {
        id: 'card-details',
        title: 'Work on a card',
        icon: ListChecks,
        summary: 'Status, assignee, priority, dates, checklist, comments and history.',
        topics: [
          {
            heading: 'Open a card',
            text: 'Click any card on the board, list, calendar or timeline. A panel slides in from the right with three tabs: **Details**, **Comments** and **History**.',
          },
          {
            heading: 'Change the status (move the card)',
            bullets: [
              'Drag the card to another column on the **Board**, or',
              'change **Status** in the card panel, or',
              'change the **Status** dropdown on its row in **List** view, or',
              'ask the AI: "Move \'Booking flow 2\' to Done".',
            ],
          },
          {
            heading: 'Details you can set',
            bullets: [
              '**Title**: click it at the top of the panel to edit.',
              '**Priority**: Low, Medium, High or Urgent. Shown as a colored tag on the card.',
              '**Assignee**: who is doing it. They see it in their **My tasks**.',
              '**Start date** and **Due date**: drive the Calendar, the Timeline and the overdue warnings.',
              '**Fields**: any custom fields the project has.',
              '**Description**: longer notes.',
              '**Checklist**: type an item in **Add an item, press Enter**. Tick items off as you go; progress shows on the card.',
              '**Files** and **Time**: see their own sections below.',
            ],
            tip: 'Everything saves automatically. There is no Save button.',
          },
          {
            heading: 'Comments',
            text: 'Open the **Comments** tab, write in **Write a comment...** and press **Ctrl + Enter** or click **Post**. Everyone on the project can see comments.',
          },
          {
            heading: 'History',
            text: 'The **History** tab lists every change to the card: who changed what, and when. Changes made by automations show up here too.',
          },
          {
            heading: 'Share, copy or delete',
            bullets: [
              '**Copy link**: copies a direct link to this card for chat or email.',
              '**Duplicate**: makes a copy.',
              '**Delete task**: removes the card after you confirm. You need delete rights.',
            ],
          },
        ],
      },
      {
        id: 'views',
        title: 'Board, List, Calendar and Timeline',
        icon: Columns3,
        summary: 'Four ways to look at the same cards, plus filters.',
        topics: [
          {
            heading: 'Switch views',
            text: 'Use the tabs under the project name: **Board** (B), **List** (L), **Calendar** (C) and **Timeline**. The app remembers your choice for each project.',
          },
          {
            heading: 'Board',
            text: 'Columns of cards. Drag cards between columns to change status, and up or down to reorder. Cards show their priority, fields, due date, checklist progress, file count, time logged and assignee.',
          },
          {
            heading: 'List: edit many cards at once',
            steps: [
              'Switch to **List** view.',
              'Tick the box next to each card, or the box on a column heading to select every card in it.',
              'In the bar that appears at the bottom, use **Move to…**, **Assign…** or **Priority…** to change them all together. Click the ✕ to clear the selection.',
            ],
            tip: 'You can also change Status, Assignee, Priority and Due date directly on each row.',
          },
          {
            heading: 'Calendar',
            text: 'Cards placed on their due dates. Use the arrows to change month, **Today** to come back, and click a day to see or add its cards.',
          },
          {
            heading: 'Timeline (Gantt)',
            steps: [
              'Click the **Timeline** tab. Each card is a bar from its start date to its due date, grouped by column. The gold line is today.',
              'Use **Days**, **Weeks** or **Months** to zoom, and **Today** to jump back to today.',
              'Drag a bar left or right to move the card\'s dates. Drag the left or right end of a bar to change just the start or due date.',
              'Click a bar to open the card. Click a group heading to collapse it.',
              'Cards with no dates show as dashed bars. Untick **Show cards without dates** to hide them.',
            ],
          },
          {
            heading: 'Filters',
            text: 'Above every view: type in **Filter tasks**, or narrow by **Status**, **Priority**, **Assignee** or due date (Overdue, Due today, Due this week, No due date). Filters apply to whichever view you are on.',
          },
        ],
      },
      {
        id: 'files',
        title: 'File attachments',
        icon: Paperclip,
        summary: 'Attach documents, images and designs to a card.',
        topics: [
          {
            heading: 'Attach a file',
            steps: [
              'Open the card and scroll to **Files** in the Details tab.',
              'Drag files from your computer onto the Files area, or click **Add files** and pick them.',
              'Wait for the upload to finish. The file shows its size, who uploaded it and when.',
            ],
          },
          {
            heading: 'Open, download or delete',
            bullets: [
              'Click the file name to open it in a new tab.',
              'Click the download icon to save it.',
              'Click the bin to delete it. You can delete your own files; project leads can delete any.',
            ],
          },
          {
            heading: 'Limits',
            text: 'Up to 25 MB per file. Files are private to people on the project. The paperclip on a board card shows how many files it has.',
          },
        ],
      },
      {
        id: 'time',
        title: 'Time tracking',
        icon: Clock,
        summary: 'Record how long work takes, with a timer or by hand.',
        topics: [
          {
            heading: 'Use the timer',
            steps: [
              'Open the card and find **Time** in the Details tab.',
              'Click **Start timer** when you begin work.',
              'Click **Stop** when you finish. The time is saved to the card.',
            ],
            tip: 'Starting a timer on another card stops the one already running, so you never double-count.',
          },
          {
            heading: 'Log time by hand',
            steps: [
              'Click **Log time**.',
              'Enter the time spent in any of these forms: **1h 30m**, **90m**, **1.5h**, **1:30** or just **45** (minutes).',
              'Pick the day and add an optional note about what you did.',
              'Click **Add**.',
            ],
          },
          {
            heading: 'Where time shows up',
            bullets: [
              'The total on the card (the clock tag on the board).',
              'The list of entries in the card\'s **Time** section. Delete a wrong entry with its bin icon.',
              '**Reports → Time logged this week/month**, broken down by person.',
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Automation and AI',
    sections: [
      {
        id: 'automations',
        title: 'Automations',
        icon: Zap,
        summary: '"When this happens, do that." Let the board do routine updates for you.',
        topics: [
          {
            heading: 'What an automation is',
            text: 'A rule for one project with a **When** (the trigger) and a **Then** (one or more actions). When someone changes a card in the app and the trigger matches, the actions run straight away and a message pops up to say so.',
          },
          {
            heading: 'Triggers ("When")',
            bullets: [
              '**A card is created**',
              '**A card moves to** a chosen column (for example Review)',
              '**A card\'s priority becomes** a chosen level (for example Urgent)',
            ],
          },
          {
            heading: 'Actions ("Then")',
            bullets: [
              '**Assign** to a person, to **Whoever created the card**, or to **Nobody (unassign)**',
              '**Set priority**',
              '**Move to** another column',
              '**Set due date** a number of days from now (0 means today)',
              '**Add checklist items** (one per line)',
              '**Add a comment** (shown as "Automation: …")',
            ],
          },
          {
            heading: 'Create an automation',
            steps: [
              'Open the project and click **Automations** (or **⋯ → Automations**).',
              'Click **Add an automation** and type a **Name**, for example "Ready for review".',
              'Under **When**, choose the trigger, for example **a card moves to → Review**.',
              'Under **Then**, choose the first action, for example **Set priority → High**.',
              'Click **Add another action** for more steps, for example **Add checklist items**: "Code reviewed" and "QA sign-off".',
              'Read the plain-English sentence under the form to check the rule does what you expect.',
              'Click **Add automation**.',
            ],
          },
          {
            heading: 'Test it',
            steps: [
              'Close the Automations window and drag a card into the column you picked.',
              'Watch for the pop-up at the bottom of the screen saying the automation ran.',
              'Open the card: check the priority, checklist, due date, assignee or comment.',
              'Open the card\'s **History** tab to see each change the automation made.',
            ],
          },
          {
            heading: 'Pause, edit or delete',
            text: 'In the Automations window, use the switch to turn a rule off and on, the pencil to edit it, or the bin to delete it.',
          },
          {
            heading: 'Good to know',
            bullets: [
              'Only project leads and governors can create or change automations.',
              'Rules run when cards change in ActivTrack (board, list, card panel or AI assistant), not when data is edited directly in the database.',
              'An automation\'s own changes never trigger other automations, so rules can\'t loop forever.',
              'Time-based rules (such as "every Monday") are not supported.',
            ],
          },
          {
            heading: 'Ideas',
            bullets: [
              'When a card is created → assign to whoever created it.',
              'When a card moves to In progress → make it due in 5 days.',
              'When priority becomes Urgent → assign to the team lead and add a comment "Escalated".',
              'When a card moves to Done → add checklist "Update release notes".',
            ],
          },
        ],
      },
      {
        id: 'ai-assistant',
        title: 'AI assistant',
        icon: Bot,
        summary: 'Add, move and update cards by typing what you want.',
        topics: [
          {
            heading: 'Open it',
            bullets: [
              'Click **Ask AI** at the top of the screen, or',
              'press **Ctrl + K** (⌘ + K on a Mac) from anywhere, or',
              'click **AI assistant** in the sidebar, or the **Ask AI to add or move cards…** box on Home.',
            ],
          },
          {
            heading: 'Use it',
            steps: [
              'Check the **Project** picker at the top of the window. Requests apply to that project.',
              'Type what you want in plain English, or click one of the examples under **Try**.',
              'Press **Enter** (or the arrow button). The assistant shows a preview: each **New card** or **Update card** it plans, with the changes.',
              'Check the preview. If it looks right, press **Enter** again to apply it. To change the request, just edit the text and press Enter.',
              'Click **Start over** to clear it, or press **Esc** to close.',
            ],
            tip: 'Nothing changes until you confirm the preview, and the assistant can only do what your own access allows.',
          },
          {
            heading: 'Things you can ask',
            bullets: [
              '"Add a card to fix the login bug, high priority, due Friday"',
              '"Add these cards:" followed by a list on new lines (one card per line)',
              '"Move \'Booking flow 2\' to Done"',
              '"Assign \'Stripe deposits 4\' to me and make it urgent"',
              '"Move all overdue cards to Review"',
              '"Set the due date of \'SOAP notes 8\' to next Wednesday"',
            ],
          },
          {
            heading: 'Built-in commands vs full AI',
            text: 'If the window says **Built-in commands**, no AI key is set up yet. Simple requests like "add a card…" and "move X to Done" still work. For free-form requests, the site owner adds a free Gemini or Groq key in Vercel (see DEPLOY.md in the project code).',
          },
        ],
      },
    ],
  },
  {
    title: 'Tracking progress',
    sections: [
      {
        id: 'status-updates',
        title: 'Project status updates',
        icon: Activity,
        summary: 'Tell everyone whether a project is On track, At risk or Off track.',
        topics: [
          {
            heading: 'Post an update',
            steps: [
              'Open the project. Under its name, click **Post a status update** (or the latest status badge if one exists).',
              'Click **Write this week\'s update**. ActivTrack drafts it from the cards: progress, what finished this week, what is overdue and what is coming up. It also suggests a health.',
              'Pick the health: **On track**, **At risk**, **Off track** or **Complete**.',
              'Edit the **Title** and **Update** text as you like.',
              'Click **Post update**.',
            ],
            tip: 'Prefer your own words? Click **Start blank** instead.',
          },
          {
            heading: 'Where updates appear',
            bullets: [
              'The latest badge and title under the project name.',
              'Next to each project in **Home → Project progress**.',
              'The full history in the Status updates window, newest first.',
            ],
          },
          {
            heading: 'Edit or delete',
            text: 'Open the Status updates window and use the pencil (your own updates) or the bin. Only project leads and governors can post.',
          },
        ],
      },
      {
        id: 'dashboard',
        title: 'Home dashboard',
        icon: Home,
        summary: 'Everything that needs you, at a glance.',
        topics: [
          {
            heading: 'What\'s on Home',
            bullets: [
              'Summary numbers: **Open tasks**, **Overdue**, **Due today** and **Done this week**.',
              '**Needs attention**: overdue and due-today cards across all your projects. Click one to open it.',
              '**Project progress**: how much of each project is done, with its latest health badge.',
              '**Open tasks by member**: who has how much work.',
              'A box to ask the AI assistant.',
            ],
          },
        ],
      },
      {
        id: 'reports',
        title: 'Reports',
        icon: BarChart3,
        summary: 'Daily, weekly and monthly reports to read, print or download.',
        topics: [
          {
            heading: 'Generate a report',
            steps: [
              'Click **Reports** in the sidebar.',
              'Choose **Daily**, **Weekly** or **Monthly**. Use the arrows or the date box to look at an earlier day, week or month.',
              'Choose **All projects** or a single project.',
              'Read the results: cards created and completed, completion rate, overdue, the trend chart, cards by status, priority and person, and **Time logged**.',
            ],
          },
          {
            heading: 'Share it',
            bullets: [
              '**Print / PDF**: opens the print dialog. Choose "Save as PDF" to get a file. Reports always print in light colors.',
              '**CSV download**: the numbers as a spreadsheet for Excel or Google Sheets.',
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Account',
    sections: [
      {
        id: 'settings',
        title: 'Settings',
        icon: Settings,
        summary: 'Your profile, theme, data export and admin settings.',
        topics: [
          {
            heading: 'Tabs in Settings',
            bullets: [
              '**Profile**: your **Display name** and **Avatar color**.',
              '**App & theme**: **Light**, **Dark** or **System** theme, and **Install ActivTrack** as an app on your computer or phone.',
              '**Data**: **Export CSV** of every task you can see.',
              '**Users** (governors): add people, change roles, disable accounts, manage project access.',
              '**Sign-in** (governors): which sign-in methods are allowed, and directory (LDAP) settings.',
            ],
          },
        ],
      },
      {
        id: 'shortcuts',
        title: 'Keyboard shortcuts',
        icon: Keyboard,
        summary: 'Work faster without the mouse.',
        topics: [
          {
            heading: 'Anywhere',
            bullets: [
              '**/**: search',
              '**Ctrl + K**: AI assistant',
              '**G** then **H**: Home · **G** then **M**: My tasks · **G** then **R**: Reports',
              '**T**: switch light and dark',
              '**?**: show all shortcuts · **G** then **?**: open Help',
            ],
          },
          {
            heading: 'In a project',
            bullets: [
              '**N**: add a new card',
              '**B**, **L**, **C**: Board, List, Calendar view',
              '**Esc**: close the open card or window',
            ],
          },
        ],
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: LifeBuoy,
        summary: 'Common messages and what to do about them.',
        topics: [
          {
            heading: '"…needs a one-time database update"',
            text: 'A newer feature (custom fields, templates, automations, status updates, files or time tracking) needs a table that isn\'t in the database yet. The site owner runs the SQL file named in the message once, in Supabase → SQL Editor. The rest of the app keeps working meanwhile.',
          },
          {
            heading: 'I can\'t edit anything / "View only"',
            text: 'You have **Read only** access to that project, or it is archived. Ask the project lead to change your access in **People**.',
          },
          {
            heading: 'I don\'t see the Automations or Workflow buttons',
            text: 'These are for project leads and governors only. On smaller screens they are inside the **⋯** menu.',
          },
          {
            heading: 'Changes from teammates don\'t appear',
            text: 'They normally appear within a second. If not, refresh the page. If it keeps happening, the site owner should check that real-time updates are turned on (see DEPLOY.md).',
          },
          {
            heading: 'The AI says "Built-in commands"',
            text: 'No AI key is configured. Simple requests still work. See **AI assistant → Built-in commands vs full AI**.',
          },
        ],
      },
    ],
  },
];

export const ALL_SECTIONS = HELP.flatMap((g) => g.sections);
